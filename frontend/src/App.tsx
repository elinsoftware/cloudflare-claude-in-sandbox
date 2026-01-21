import { useState, useCallback } from 'react'
import { ConnectForm, updateStoredSessionId } from './components/ConnectForm'
import { Terminal } from './components/Terminal'
import { StatusBar } from './components/StatusBar'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface Session {
  sessionId: string
  wsUrl: string
  workerUrl: string
  instance: string
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = useCallback(
    async (credentials: {
      workerUrl: string
      instance: string
      username: string
      password: string
      anthropicApiKey: string
      sessionId: string
    }) => {
      setStatus('connecting')
      setError(null)

      // Remove trailing slash from worker URL
      const workerUrl = credentials.workerUrl.replace(/\/$/, '')

      try {
        // If sessionId is provided, try to reconnect to existing session
        if (credentials.sessionId) {
          const wsProtocol = workerUrl.startsWith('https') ? 'wss:' : 'ws:'
          const host = new URL(workerUrl).host
          const wsUrl = `${wsProtocol}//${host}/api/terminal/${credentials.sessionId}`

          setSession({
            sessionId: credentials.sessionId,
            wsUrl,
            workerUrl,
            instance: credentials.instance,
          })
          setStatus('connected')
          return
        }

        // Otherwise create a new session
        const response = await fetch(`${workerUrl}/api/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instance: credentials.instance,
            username: credentials.username,
            password: credentials.password,
            anthropicApiKey: credentials.anthropicApiKey,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Connection failed: ${response.status}`)
        }

        const data = await response.json()
        setSession({
          sessionId: data.sessionId,
          wsUrl: data.wsUrl,
          workerUrl,
          instance: credentials.instance,
        })
        // Save the new session ID to localStorage for reconnection
        updateStoredSessionId(data.sessionId)
        setStatus('connected')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed')
        setStatus('disconnected')
      }
    },
    []
  )

  const handleDisconnect = useCallback(async () => {
    if (session) {
      try {
        await fetch(`${session.workerUrl}/api/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId }),
        })
      } catch {
        // Ignore disconnect errors
      }
    }
    setSession(null)
    setStatus('disconnected')
  }, [session])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-semibold">Claude Code Sandbox</h1>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {status === 'disconnected' || status === 'connecting' ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-medium mb-2">Connect to ServiceNow</h2>
                <p className="text-gray-400 text-sm">
                  Enter your ServiceNow credentials to start a Claude Code session
                </p>
              </div>

              <ConnectForm
                onConnect={handleConnect}
                disabled={status === 'connecting'}
              />

              {error && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <Terminal wsUrl={session?.wsUrl ?? null} onDisconnect={handleDisconnect} />
          </div>
        )}
      </main>

      <StatusBar status={status} instance={session?.instance} />
    </div>
  )
}

export default App
