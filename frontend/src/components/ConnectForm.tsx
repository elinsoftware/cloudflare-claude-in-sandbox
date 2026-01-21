import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'claude-sandbox-credentials'

interface StoredCredentials {
  workerUrl: string
  instance: string
  username: string
  password: string
  anthropicApiKey: string
  sessionId: string // Optional: reuse existing session
}

interface ConnectFormProps {
  onConnect: (credentials: StoredCredentials) => void
  onSessionCreated?: (sessionId: string) => void
  disabled?: boolean
}

function loadFromStorage(): StoredCredentials {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { workerUrl: '', instance: '', username: '', password: '', anthropicApiKey: '', sessionId: '' }
}

function saveToStorage(credentials: StoredCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials))
}

// Export for updating sessionId from outside
export function updateStoredSessionId(sessionId: string) {
  const stored = loadFromStorage()
  stored.sessionId = sessionId
  saveToStorage(stored)
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

export function ConnectForm({ onConnect, disabled }: ConnectFormProps) {
  // Initialize state directly from localStorage
  const [credentials, setCredentials] = useState<StoredCredentials>(loadFromStorage)
  const hasLoadedRef = useRef(false)

  // Mark as loaded after first render
  useEffect(() => {
    hasLoadedRef.current = true
  }, [])

  // Save to localStorage when values change (but not on initial load)
  useEffect(() => {
    if (hasLoadedRef.current) {
      saveToStorage(credentials)
    }
  }, [credentials])

  const updateField = (field: keyof StoredCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { workerUrl, instance, username, password, anthropicApiKey } = credentials
    if (workerUrl && instance && username && password && anthropicApiKey) {
      saveToStorage(credentials) // Ensure saved on submit
      onConnect(credentials)
    }
  }

  const handleClear = () => {
    clearStorage()
    setCredentials({ workerUrl: '', instance: '', username: '', password: '', anthropicApiKey: '', sessionId: '' })
  }

  const { workerUrl, instance, username, password, anthropicApiKey, sessionId } = credentials

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="workerUrl" className="block text-sm font-medium text-gray-300 mb-1">
          Worker URL
        </label>
        <input
          type="url"
          id="workerUrl"
          value={workerUrl}
          onChange={(e) => updateField('workerUrl', e.target.value)}
          placeholder="https://claude-sandbox-worker.xxx.workers.dev"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          required
        />
      </div>

      <div>
        <label htmlFor="sessionId" className="block text-sm font-medium text-gray-300 mb-1">
          Session ID <span className="text-gray-500">(optional - reuse existing)</span>
        </label>
        <input
          type="text"
          id="sessionId"
          value={sessionId}
          onChange={(e) => updateField('sessionId', e.target.value)}
          placeholder="Leave empty to create new session"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
      </div>

      <hr className="border-gray-700" />

      <div>
        <label htmlFor="instance" className="block text-sm font-medium text-gray-300 mb-1">
          ServiceNow Instance
        </label>
        <input
          type="text"
          id="instance"
          value={instance}
          onChange={(e) => updateField('instance', e.target.value)}
          placeholder="dev12345.service-now.com"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          required
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
          Username
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => updateField('username', e.target.value)}
          placeholder="admin"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => updateField('password', e.target.value)}
          placeholder="••••••••"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          required
        />
      </div>

      <div>
        <label htmlFor="anthropicApiKey" className="block text-sm font-medium text-gray-300 mb-1">
          Anthropic API Key
        </label>
        <input
          type="password"
          id="anthropicApiKey"
          value={anthropicApiKey}
          onChange={(e) => updateField('anthropicApiKey', e.target.value)}
          placeholder="sk-ant-..."
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          required
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || !workerUrl || !instance || !username || !password || !anthropicApiKey}
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          {disabled ? 'Connecting...' : 'Connect'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 rounded-md transition-colors"
          title="Clear saved credentials"
        >
          Clear
        </button>
      </div>
    </form>
  )
}
