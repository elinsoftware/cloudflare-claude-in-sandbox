const STORAGE_KEY = 'claude-sandbox-credentials'

export interface StoredCredentials {
  workerUrl: string
  instance: string
  username: string
  password: string
  anthropicApiKey: string
  sessionId: string
}

export function loadFromStorage(): StoredCredentials {
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

export function saveToStorage(credentials: StoredCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials))
}

export function updateStoredSessionId(sessionId: string) {
  const stored = loadFromStorage()
  stored.sessionId = sessionId
  saveToStorage(stored)
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}
