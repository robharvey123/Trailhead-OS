const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const seedEmail = process.env.SEED_USER_EMAIL || 'demo@rushanalytics.local'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const findOrCreateUser = async () => {
  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) {
    throw error
  }

  const existing = users.users.find((user) => user.email === seedEmail)
  if (existing) {
    return existing.id
  }

  const { data, error: createError } = await supabase.auth.admin.createUser({
    email: seedEmail,
    email_confirm: true,
    password: crypto.randomBytes(16).toString('hex'),
  })

  if (createError || !data.user) {
    throw createError || new Error('Failed to create seed user.')
  }

  return data.user.id
}

const run = async () => {
  const userId = await findOrCreateUser()

  const { data: existingWorkspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', 'RUSH Demo')
    .maybeSingle()

  if (existingWorkspace) {
    console.log('Seed data already exists.')
    return
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: 'RUSH Demo', owner_user_id: userId, is_paid: false })
    .select('id')
    .single()

  if (workspaceError || !workspace) {
    throw workspaceError || new Error('Failed to create workspace.')
  }

  const workspaceId = workspace.id

  await supabase.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
  })

  await supabase.from('workspace_settings').insert({
    workspace_id: workspaceId,
    brand_filter: 'RUSH',
    cogs_pct: 0.55,
    promo_cost: 0.55,
    currency_symbol: '$',
  })

  await supabase.from('customer_mappings').insert([
    {
      workspace_id: workspaceId,
      sell_in_customer: 'Haypp Dach',
      sell_out_company: 'Haypp Group',
      group_name: 'Haypp (Combined)',
    },
    {
      workspace_id: workspaceId,
      sell_in_customer: 'Haypp UK',
      sell_out_company: 'Haypp Group',
      group_name: 'Haypp (Combined)',
    },
    {
      workspace_id: workspaceId,
      sell_in_customer: 'Pouches Denmark',
      sell_out_company: 'Europesnus',
    },
  ])

  await supabase.from('sell_in').insert([
    {
      workspace_id: workspaceId,
      customer: 'Haypp Dach',
      country: 'DE',
      brand: 'RUSH',
      product: 'RUSH Berry',
      date: '2024-01-15',
      qty_cans: 12000,
      unit_price: 0.85,
      total: 10200,
      promo_cans: 500,
    },
    {
      workspace_id: workspaceId,
      customer: 'Haypp UK',
      country: 'GB',
      brand: 'RUSH',
      product: 'RUSH Berry',
      date: '2024-01-22',
      qty_cans: 8000,
      unit_price: 0.85,
      total: 6800,
      promo_cans: 300,
    },
    {
      workspace_id: workspaceId,
      customer: 'Pouches Denmark',
      country: 'DK',
      brand: 'RUSH',
      product: 'RUSH Mint',
      date: '2024-02-10',
      qty_cans: 9000,
      unit_price: 0.82,
      total: 7380,
      promo_cans: 200,
    },
    {
      workspace_id: workspaceId,
      customer: 'Nordic Distribution',
      country: 'SE',
      brand: 'RUSH',
      product: 'RUSH Citrus',
      date: '2024-03-06',
      qty_cans: 7500,
      unit_price: 0.8,
      total: 6000,
      promo_cans: 150,
    },
  ])

  await supabase.from('sell_out').insert([
    {
      workspace_id: workspaceId,
      company: 'Haypp Group',
      brand: 'RUSH',
      product: 'RUSH Berry',
      month: '2024-01-01',
      units: 9000,
      platform: 'Online',
      region: 'EU',
    },
    {
      workspace_id: workspaceId,
      company: 'Haypp Group',
      brand: 'RUSH',
      product: 'RUSH Berry',
      month: '2024-02-01',
      units: 9200,
      platform: 'Online',
      region: 'EU',
    },
    {
      workspace_id: workspaceId,
      company: 'Europesnus',
      brand: 'RUSH',
      product: 'RUSH Mint',
      month: '2024-02-01',
      units: 4100,
      platform: 'Retail',
      region: 'EU',
    },
    {
      workspace_id: workspaceId,
      company: 'Nordic Distribution',
      brand: 'RUSH',
      product: 'RUSH Citrus',
      month: '2024-03-01',
      units: 5600,
      platform: 'Online',
      region: 'EU',
    },
  ])

  console.log('Seed data inserted for workspace:', workspaceId)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
