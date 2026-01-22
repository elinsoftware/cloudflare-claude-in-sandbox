import { useState, useEffect, useRef } from 'react'
import { type StoredCredentials, loadFromStorage, saveToStorage, clearStorage } from '../utils/storage'

interface ConnectFormProps {
  onConnect: (credentials: StoredCredentials) => void
  onSessionCreated?: (sessionId: string) => void
  disabled?: boolean
}

function detectServiceNowInstance(): string | null {
  try {
    const hostname = window.location.hostname
    // Check if running on a ServiceNow instance (*.service-now.com or *.servicenow.com)
    if (hostname.includes('service-now.com') || hostname.includes('servicenow.com')) {
      return hostname
    }
  } catch {
    // Ignore errors
  }
  return null
}

// Compute initial visibility state once at module load
function getInitialVisibility() {
  const stored = loadFromStorage()
  const detectedInstance = detectServiceNowInstance()
  return {
    showWorkerUrl: !stored.workerUrl,
    showInstance: !stored.instance && !detectedInstance,
  }
}

export function ConnectForm({ onConnect, disabled }: ConnectFormProps) {
  // Track initial visibility (computed once on mount)
  const [visibility, setVisibility] = useState(getInitialVisibility)

  // Initialize state directly from localStorage
  const [credentials, setCredentials] = useState<StoredCredentials>(() => {
    const stored = loadFromStorage()
    // Auto-detect ServiceNow instance if not stored
    if (!stored.instance) {
      const detected = detectServiceNowInstance()
      if (detected) {
        stored.instance = detected
      }
    }
    return stored
  })
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
    setVisibility({ showWorkerUrl: true, showInstance: !detectServiceNowInstance() })
  }

  const { workerUrl, instance, username, password, anthropicApiKey, sessionId } = credentials
  const { showWorkerUrl, showInstance } = visibility

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {showWorkerUrl && (
        <div>
          <label htmlFor="workerUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Worker URL
          </label>
          <input
            type="url"
            id="workerUrl"
            value={workerUrl}
            onChange={(e) => updateField('workerUrl', e.target.value)}
            placeholder="https://claude-sandbox-worker.xxx.workers.dev"
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            required
          />
        </div>
      )}

      <div>
        <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700 mb-1">
          User ID <span className="text-gray-400">(optional - reuse existing)</span>
        </label>
        <input
          type="text"
          id="sessionId"
          value={sessionId}
          onChange={(e) => updateField('sessionId', e.target.value)}
          placeholder="Leave empty to create new session"
          disabled={disabled}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
      </div>

      <hr className="border-gray-200" />

      {showInstance && (
        <div>
          <label htmlFor="instance" className="block text-sm font-medium text-gray-700 mb-1">
            ServiceNow Instance
          </label>
          <input
            type="text"
            id="instance"
            value={instance}
            onChange={(e) => updateField('instance', e.target.value)}
            placeholder="dev12345.service-now.com"
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            required
          />
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Account
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder="admin"
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            required
          />
        </div>
        <div className="flex-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="••••••••"
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="anthropicApiKey" className="block text-sm font-medium text-gray-700 mb-1">
          Anthropic API Key
        </label>
        <input
          type="password"
          id="anthropicApiKey"
          value={anthropicApiKey}
          onChange={(e) => updateField('anthropicApiKey', e.target.value)}
          placeholder="sk-ant-..."
          disabled={disabled}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          required
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || !workerUrl || !instance || !username || !password || !anthropicApiKey}
          className="flex-1 py-2 px-4 bg-[rgb(3,45,66)] hover:bg-[rgb(2,35,52)] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[rgb(3,45,66)] focus:ring-offset-2"
        >
          {disabled ? 'Connecting...' : 'Connect'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 rounded-md transition-colors"
          title="Clear saved credentials"
        >
          Clear
        </button>
      </div>
    </form>
  )
}
