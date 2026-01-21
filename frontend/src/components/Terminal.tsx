import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface TerminalProps {
  wsUrl: string | null
  onDisconnect: () => void
}

// ttyd protocol message types
const TTYD_OUTPUT = 0
const TTYD_SET_WINDOW_TITLE = 1
const TTYD_SET_PREFS = 2
const TTYD_INPUT = '0'
const TTYD_RESIZE = '1'

export function Terminal({ wsUrl, onDisconnect }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Send resize to ttyd
  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      // ttyd resize format: "1" + JSON
      ws.send(TTYD_RESIZE + JSON.stringify({ columns: cols, rows: rows }))
    }
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#eaeaea',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#3d3d5c',
      },
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)

    xterm.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      xterm.dispose()
    }
  }, [])

  useEffect(() => {
    if (!wsUrl || !xtermRef.current) return

    const xterm = xtermRef.current
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const fullWsUrl = wsUrl.startsWith('ws') ? wsUrl : `${protocol}//${window.location.host}${wsUrl}`

    // Connect to WebSocket (ttyd protocol)
    const ws = new WebSocket(fullWsUrl)
    ws.binaryType = 'arraybuffer'
    console.log('[Terminal] Connecting to WebSocket:', fullWsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[Terminal] WebSocket connected')
      xterm.writeln('\x1b[32mConnected to Claude Code sandbox\x1b[0m')
      xterm.writeln('')

      // Delay sending initial terminal size to let ttyd initialize
      setTimeout(() => {
        if (fitAddonRef.current && ws.readyState === WebSocket.OPEN) {
          const dims = fitAddonRef.current.proposeDimensions()
          if (dims) {
            console.log('[Terminal] Sending initial size:', dims.cols, dims.rows)
            sendResize(dims.cols, dims.rows)
          }
        }
      }, 500)
    }

    ws.onmessage = (event) => {
      console.log('[Terminal] Message received, type:', typeof event.data, event.data instanceof ArrayBuffer ? 'ArrayBuffer' : 'other')
      // ttyd sends binary messages with a type prefix
      if (event.data instanceof ArrayBuffer) {
        const data = new Uint8Array(event.data)
        console.log('[Terminal] Binary data length:', data.length, 'first byte:', data[0])
        if (data.length === 0) return

        const msgType = data[0]
        const payload = data.slice(1)

        switch (msgType) {
          case TTYD_OUTPUT:
            // Terminal output
            xterm.write(payload)
            break
          case TTYD_SET_WINDOW_TITLE:
            // Window title (we can ignore)
            console.log('[Terminal] Window title message')
            break
          case TTYD_SET_PREFS:
            // Preferences (we can ignore)
            console.log('[Terminal] Prefs message')
            break
          default:
            console.log('[Terminal] Unknown message type:', msgType)
        }
      } else {
        // Fallback for text messages
        console.log('[Terminal] Text message:', event.data)
        xterm.write(event.data)
      }
    }

    let intentionalClose = false

    ws.onclose = () => {
      if (!intentionalClose) {
        xterm.writeln('')
        xterm.writeln('\x1b[31mDisconnected from sandbox\x1b[0m')
        onDisconnect()
      }
    }

    ws.onerror = () => {
      xterm.writeln('\x1b[31mWebSocket error\x1b[0m')
    }

    // Send terminal input to ttyd
    const disposeOnData = xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        // ttyd input format: "0" + data
        console.log('[Terminal] Sending input:', data.length, 'chars')
        ws.send(TTYD_INPUT + data)
      }
    })

    // Send resize events
    const disposeOnResize = xterm.onResize(({ cols, rows }) => {
      sendResize(cols, rows)
    })

    return () => {
      intentionalClose = true
      disposeOnData.dispose()
      disposeOnResize.dispose()
      ws.close()
    }
  }, [wsUrl, onDisconnect, sendResize])

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-300">Claude Code Terminal</span>
        <button
          onClick={onDisconnect}
          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 p-2 bg-[#1a1a2e]" />
    </div>
  )
}
