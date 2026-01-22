import { useState, useCallback } from 'react'
import { ConnectForm } from './components/ConnectForm'
import { updateStoredSessionId } from './utils/storage'
import { Terminal } from './components/Terminal'
import { StatusBar } from './components/StatusBar'
import heroImg from './assets/hero.png'

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
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null)

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
        // Call backend to connect (handles both new sessions and reconnections)
        const response = await fetch(`${workerUrl}/api/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instance: credentials.instance,
            username: credentials.username,
            password: credentials.password,
            anthropicApiKey: credentials.anthropicApiKey,
            sessionId: credentials.sessionId || undefined,
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

  const isLanding = status === 'disconnected' || status === 'connecting'

  return (
    <div className={`flex flex-col h-screen ${isLanding ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'}`}>
      <main className="flex-1 flex overflow-hidden">
        {isLanding ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
              <div className="mb-6 text-center">
                <img
                  src={heroImg}
                  alt="Claude Code Terminal"
                  className="w-full rounded-lg mb-6"
                />
                <h2 className="text-xl font-medium mb-2">Connect to Claude Code</h2>
                <p className="text-gray-500 text-sm">
                  Enter your credentials to start a Claude Code session
                </p>
                <a
                  href="https://github.com/elinsoftware/cloudflare-claude-in-sandbox"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  View on GitHub
                </a>
              </div>

              <ConnectForm
                onConnect={handleConnect}
                onUserDetected={setLoggedInUser}
                disabled={status === 'connecting'}
              />

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700 text-sm">
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

      <StatusBar status={status} workerUrl={session?.workerUrl} instance={session?.instance} userName={loggedInUser} />
    </div>
  )
}

export default App
