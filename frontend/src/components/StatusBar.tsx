type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface StatusBarProps {
  status: ConnectionStatus
  workerUrl?: string
  instance?: string
}

function extractWorkerName(url: string): string {
  try {
    const hostname = new URL(url).hostname
    // Extract worker name from subdomain (e.g., "claude-sandbox-worker" from "claude-sandbox-worker.xxx.workers.dev")
    const parts = hostname.split('.')
    return parts[0] || hostname
  } catch {
    return url
  }
}

export function StatusBar({ status, workerUrl, instance }: StatusBarProps) {
  const statusConfig = {
    disconnected: { color: 'bg-gray-500', text: 'Disconnected' },
    connecting: { color: 'bg-yellow-500', text: 'Connecting...' },
    connected: { color: 'bg-green-500', text: 'Connected' },
  }

  const { color, text } = statusConfig[status]
  const workerName = workerUrl ? extractWorkerName(workerUrl) : null

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[rgb(3,45,66)]">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-gray-300">{text}</span>
        {workerName && status === 'connected' && (
          <span className="text-sm text-gray-500">- {workerName}</span>
        )}
      </div>
      {instance && status === 'connected' && (
        <span className="text-sm text-gray-500">{instance}</span>
      )}
    </div>
  )
}
