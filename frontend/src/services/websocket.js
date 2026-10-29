/**
 * WebSocket service using @stomp/stompjs over native WebSocket.
 * Connects to Spring Boot STOMP endpoint for real-time notifications.
 */
import { Client } from '@stomp/stompjs'
import { useAuthStore } from '../store/authStore'

let stompClient = null
let destroyed = false

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1']

const normalizeJwtToken = (token) => {
  if (typeof token !== 'string') return null
  const trimmed = token.trim()
  if (!trimmed) return null
  const raw = trimmed.toLowerCase().startsWith('bearer ') ? trimmed.slice(7).trim() : trimmed
  if (raw.split('.').length === 3 && !raw.includes(' ')) return raw
  return null
}

function emitRealtimeNotification(payload) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('nexacrm:notification', { detail: payload }))
}

function resolveWebSocketUrl() {
  const explicit = String(import.meta.env.VITE_WS_URL ?? '').trim()
  const fromApiBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

  let base = explicit
  if (!base && fromApiBase) {
    base = `${fromApiBase.replace(/\/api\/?$/, '')}/ws`
  }
  if (!base) {
    base = `${window.location.origin}/ws`
  }

  try {
    const url = new URL(base, window.location.origin)
    const currentHost = window.location.hostname
    const isLocal = LOCAL_HOSTS.includes(currentHost)
    if (!isLocal && (url.hostname !== currentHost || url.port)) {
      base = `${window.location.origin}/ws`
    }
  } catch {
    base = `${window.location.origin}/ws`
  }

  base = base
    .replace(/^https:/i, 'wss:')
    .replace(/^http:/i, 'ws:')

  if (window.location.protocol === 'https:' && base.startsWith('ws://')) {
    base = `wss://${base.slice('ws://'.length)}`
  }

  return base
}

export function connectWebSocket(onNotification) {
  destroyed = false

  const token = useAuthStore.getState().token
  const jwt = normalizeJwtToken(token)
  const connectHeaders = jwt ? { Authorization: `Bearer ${jwt}` } : {}

  stompClient = new Client({
    brokerURL: resolveWebSocketUrl(),
    connectHeaders,
    debug: import.meta.env.DEV ? (msg) => console.log(msg) : () => {},
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    onConnect: () => {
      if (import.meta.env.DEV) console.info('WebSocket connected')

      stompClient.subscribe('/user/queue/notifications', (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          emitRealtimeNotification(payload)
          onNotification(payload)
        } catch { /* ignore malformed */ }
      })

      stompClient.subscribe('/topic/notifications', (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          emitRealtimeNotification(payload)
          onNotification(payload)
        } catch { /* ignore malformed */ }
      })
    },

    onStompError: (frame) => {
      console.error('WebSocket STOMP error:', frame.headers?.message || frame)
    },

    onWebSocketError: (event) => {
      console.error('WebSocket error:', event)
    },

    onDisconnect: () => {
      if (import.meta.env.DEV) console.info('WebSocket disconnected')
    },
  })

  stompClient.activate()
}

export function disconnectWebSocket() {
  destroyed = true
  if (stompClient) {
    stompClient.deactivate()
    stompClient = null
  }
}
