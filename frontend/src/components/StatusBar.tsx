type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface StatusBarProps {
  status: ConnectionStatus
  instance?: string
}

export function StatusBar({ status, instance }: StatusBarProps) {
  const statusConfig = {
    disconnected: { color: 'bg-gray-500', text: 'Disconnected' },
    connecting: { color: 'bg-yellow-500', text: 'Connecting...' },
    connected: { color: 'bg-green-500', text: 'Connected' },
  }

  const { color, text } = statusConfig[status]

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-t border-gray-700">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-sm text-gray-300">{text}</span>
      {instance && status === 'connected' && (
        <span className="text-sm text-gray-500">- {instance}</span>
      )}
    </div>
  )
}
