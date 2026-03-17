'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { PROVIDERS, type IntegrationProvider, type WorkspaceIntegration } from '@/lib/integrations/types'
import { providerRegistry } from '@/lib/integrations/registry'

type DBIntegration = Pick<WorkspaceIntegration, 'id' | 'provider' | 'status' | 'config' | 'connected_at' | 'connected_by' | 'created_at' | 'updated_at'>

export default function IntegrationsClient({
  workspaceId,
  initialIntegrations,
  isAdmin,
}: {
  workspaceId: string
  initialIntegrations: DBIntegration[]
  isAdmin: boolean
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKeyFor, setShowApiKeyFor] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  // Show toast on OAuth callback redirect
  if (connectedParam) {
    toast.success(`${providerRegistry[connectedParam as IntegrationProvider]?.name ?? connectedParam} connected!`)
  }
  if (errorParam) {
    toast.error(`Failed to connect ${providerRegistry[errorParam as IntegrationProvider]?.name ?? errorParam}`)
  }

  const connectedMap = new Map(integrations.map((i) => [i.provider, i]))

  const handleConnect = useCallback(async (provider: IntegrationProvider) => {
    const cfg = providerRegistry[provider]
    if (cfg.authType === 'api_key') {
      setShowApiKeyFor(provider)
      return
    }
    setConnecting(provider)
    try {
      const { auth_url } = await apiFetch<{ auth_url: string }>('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, provider }),
      })
      window.location.href = auth_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start connection')
      setConnecting(null)
    }
  }, [workspaceId])

  const handleApiKeySubmit = useCallback(async (provider: IntegrationProvider) => {
    if (!apiKeyInput.trim()) return
    setConnecting(provider)
    try {
      const { integration } = await apiFetch<{ integration: DBIntegration }>('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, provider, api_key: apiKeyInput.trim() }),
      })
      setIntegrations((prev) => {
        const existing = prev.findIndex((i) => i.provider === provider)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = integration
          return next
        }
        return [...prev, integration]
      })
      toast.success(`${providerRegistry[provider].name} connected`)
      setShowApiKeyFor(null)
      setApiKeyInput('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConnecting(null)
    }
  }, [workspaceId, apiKeyInput])

  const handleDisconnect = useCallback(async (provider: IntegrationProvider) => {
    try {
      await apiFetch(`/api/integrations/${provider}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      setIntegrations((prev) => prev.map((i) => i.provider === provider ? { ...i, status: 'disconnected' as const, connected_at: null, connected_by: null } : i))
      toast.success(`${providerRegistry[provider].name} disconnected`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }, [workspaceId])

  const handleSync = useCallback(async (provider: IntegrationProvider) => {
    try {
      await apiFetch(`/api/integrations/${provider}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      toast.success(`${providerRegistry[provider].name} sync triggered`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    }
  }, [workspaceId])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-slate-400">Connect external services to sync data automatically.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const cfg = providerRegistry[provider]
          const integration = connectedMap.get(provider)
          const isConnected = integration?.status === 'connected'
          const isError = integration?.status === 'error'

          return (
            <div key={provider} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cfg.icon}</span>
                  <div>
                    <h3 className="font-medium">{cfg.name}</h3>
                    <p className="text-xs text-slate-400">{cfg.description}</p>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : isError ? 'bg-rose-400' : 'bg-slate-600'
                }`} />
                <span className={`text-xs ${
                  isConnected ? 'text-emerald-400' : isError ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {isConnected ? 'Connected' : isError ? 'Error' : 'Not connected'}
                </span>
                {isConnected && integration?.connected_at && (
                  <span className="text-[10px] text-slate-500">
                    · {new Date(integration.connected_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* API Key input */}
              {showApiKeyFor === provider && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste API key..."
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => handleApiKeySubmit(provider)}
                    disabled={connecting === provider}
                    className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-50"
                  >
                    {connecting === provider ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowApiKeyFor(null); setApiKeyInput('') }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Actions */}
              {isAdmin && showApiKeyFor !== provider && (
                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleSync(provider)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:border-slate-500"
                      >
                        Sync Now
                      </button>
                      <button
                        onClick={() => handleDisconnect(provider)}
                        className="rounded-lg border border-rose-800/50 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:border-rose-700"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(provider)}
                      disabled={connecting === provider}
                      className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-50"
                    >
                      {connecting === provider ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              )}

              {!isAdmin && !isConnected && (
                <p className="text-xs text-slate-500">Contact a workspace admin to connect.</p>
              )}

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1">
                {cfg.capabilities.map((c) => (
                  <span key={c} className="rounded-full border border-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
