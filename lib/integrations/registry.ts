import type { IntegrationProvider } from './types'

export interface ProviderConfig {
  name: string
  description: string
  icon: string          // emoji for now, can swap to SVG later
  authType: 'oauth2' | 'api_key'
  oauthScopes?: string[]
  capabilities: string[]
  envKeys: string[]     // required env var names
}

export const providerRegistry: Record<IntegrationProvider, ProviderConfig> = {
  stripe: {
    name: 'Stripe',
    description: 'Payment processing, invoice payments & payment links',
    icon: '💳',
    authType: 'api_key',
    capabilities: ['invoice_payments', 'payment_links', 'webhooks'],
    envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  quickbooks: {
    name: 'QuickBooks',
    description: 'Two-way invoice, PO & contact sync with QuickBooks Online',
    icon: '📗',
    authType: 'oauth2',
    oauthScopes: ['com.intuit.quickbooks.accounting'],
    capabilities: ['invoice_sync', 'contact_sync', 'po_sync'],
    envKeys: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
  },
  xero: {
    name: 'Xero',
    description: 'Two-way invoice & contact sync with Xero',
    icon: '📘',
    authType: 'oauth2',
    oauthScopes: ['accounting.transactions', 'accounting.contacts'],
    capabilities: ['invoice_sync', 'contact_sync'],
    envKeys: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'],
  },
  slack: {
    name: 'Slack',
    description: 'Push notifications, deal alerts & slash commands to Slack',
    icon: '💬',
    authType: 'oauth2',
    oauthScopes: ['chat:write', 'commands', 'incoming-webhook'],
    capabilities: ['notifications', 'alerts', 'slash_commands'],
    envKeys: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_SIGNING_SECRET'],
  },
  google: {
    name: 'Google Calendar',
    description: 'Calendar sync for schedules and deadlines',
    icon: '🔵',
    authType: 'oauth2',
    oauthScopes: ['https://www.googleapis.com/auth/calendar'],
    capabilities: ['calendar_sync'],
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  shopify: {
    name: 'Shopify',
    description: 'Product catalog sync & order import from Shopify',
    icon: '🛒',
    authType: 'oauth2',
    oauthScopes: ['read_products', 'write_products', 'read_orders'],
    capabilities: ['product_sync', 'order_sync', 'webhooks'],
    envKeys: ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'],
  },
  klaviyo: {
    name: 'Klaviyo',
    description: 'Campaign sync, audience segments & performance metrics',
    icon: '📧',
    authType: 'api_key',
    capabilities: ['campaign_sync', 'audience_sync', 'metrics'],
    envKeys: ['KLAVIYO_API_KEY'],
  },
}
