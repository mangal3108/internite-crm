import InfoHint from '../ui/InfoHint'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Mail, Phone, Send, Search, CheckCheck, Check, Clock, AlertCircle, Plus, X, SquarePen, Reply, Forward, Trash2, Smile
} from 'lucide-react'
import SarathiMark from '../ui/SarathiMark'
import toast from 'react-hot-toast'
import { commsAPI } from '../../services/api'
import { useIntegrationsStore } from '../../store/integrationsStore'
import ScreenModalPortal from '../ui/ScreenModalPortal'
import CopyableContact from '../ui/CopyableContact'
import DateRangeFilter from '../ui/DateRangeFilter'
import { anyFieldMatchesSearch } from '../../utils/search'
import { emptyDateRange, hasDateRangeFilter, isWithinDateRange } from '../../utils/dateRangeFilter'

// ── Channel config ────────────────────────────────────────────
const CHANNEL_CONFIG = {
  whatsapp:  { icon: Phone,     color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20',  label: 'WhatsApp',  badge: 'bg-emerald-500' },
  email:     { icon: Mail,      color: 'text-brand-500',     bg: 'bg-brand-50 dark:bg-brand-950/20',          label: 'Email',     badge: 'bg-brand-500' },
}

// ── Session storage keys ─────────────────────────────────────
const HISTORY_KEY = 'nexacrm_wa_history'
const CONVERSATIONS_KEY = 'nexacrm_conversations'
const LEGACY_DUMMY_IDS = new Set(['email-1', 'insta-1', 'linkedin-1', 'facebook-1'])
const LEGACY_DUMMY_NAMES = new Set([
  'Ramesh Patel',
  'Arjun Sharma',
  'Divya Nair',
  'Kiran Mehta',
  'Sunita Rao',
  'Vijay Kumar',
  'Meera Krishnan',
  'Rajesh Singh',
  'Meera Kapoor',
])
const LEGACY_DUMMY_PHONES = new Set([
  '+91-98765-43210',
  '+91-87654-32109',
  '+91-76543-21098',
  '+91-65432-10987',
  '+91-54321-09876',
  '+91-43210-98765',
  '+91-32109-87654',
  '+91-21098-76543',
])

function loadHistory() {
  try {
    const localValue = localStorage.getItem(HISTORY_KEY)
    const sessionValue = sessionStorage.getItem(HISTORY_KEY)
    const raw = localValue ?? sessionValue ?? '{}'
    const parsed = JSON.parse(raw)
    if (localValue == null && sessionValue) {
      localStorage.setItem(HISTORY_KEY, sessionValue)
    }
    return parsed
  } catch {
    return {}
  }
}
function saveHistory(h) {
  try {
    const serialized = JSON.stringify(h)
    localStorage.setItem(HISTORY_KEY, serialized)
    sessionStorage.setItem(HISTORY_KEY, serialized)
  } catch {}
}

function loadConversations() {
  try {
    const localValue = localStorage.getItem(CONVERSATIONS_KEY)
    const sessionValue = sessionStorage.getItem(CONVERSATIONS_KEY)
    const raw = JSON.parse(localValue ?? sessionValue ?? '[]')
    if (!Array.isArray(raw)) return []
    const persisted = raw.filter((conv) => {
      if (!conv || typeof conv !== 'object') return false
      const id = String(conv.id || '')
      const name = String(conv.name || '')
      const phone = String(conv.phone || '')
      if (LEGACY_DUMMY_IDS.has(id)) return false
      if (/^wa-\d+$/.test(id)) return false
      if (LEGACY_DUMMY_NAMES.has(name)) return false
      if (LEGACY_DUMMY_PHONES.has(phone)) return false
      return true
    })
    if (localValue == null && sessionValue) {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(persisted))
    }
    return persisted
  } catch {
    return []
  }
}
function saveConversations(conversations) {
  try {
    const serialized = JSON.stringify(conversations)
    localStorage.setItem(CONVERSATIONS_KEY, serialized)
    sessionStorage.setItem(CONVERSATIONS_KEY, serialized)
  } catch {}
}

const AI_SUGGESTIONS = [
  'Thank you for sharing that! Based on your team size, I\'d recommend our Enterprise plan which includes dedicated support. Can we schedule a quick call?',
  'I understand your requirements perfectly. Our multi-tenant architecture handles exactly this use case. Would you like me to prepare a customised proposal?',
  'That\'s great to hear! I can arrange a technical walkthrough with our solutions team this week. What time works best for you?',
  'Perfect timing! We have a special offer running this month for teams over 20 users. Let me share the details.',
]
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🙏', '😮']

// ── Utility ───────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
}
function cleanPhone(p) { return String(p || '').replace(/\D/g, '') }
function convIdForWhatsApp(contact) { return `whatsapp-${cleanPhone(contact)}` }
function isPhoneOnlyName(name, phone) {
  const normalizedName = cleanPhone(name)
  const normalizedPhone = cleanPhone(phone)
  return normalizedName && normalizedPhone && normalizedName === normalizedPhone
}
function bestConversationName(previous, incoming) {
  const previousName = String(previous?.name || '').trim()
  const incomingName = String(incoming?.name || '').trim()
  const phone = incoming?.phone || previous?.phone || incoming?.recipient || previous?.recipient || ''

  if (incomingName && !isPhoneOnlyName(incomingName, phone)) return incomingName
  if (previousName && !isPhoneOnlyName(previousName, phone)) return previousName
  return incomingName || previousName || phone
}
function formatMessageTime(iso) {
  if (!iso) return nowTime()
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return nowTime()
  return dt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
}
function getErrorMessage(err, fallback) {
  if (typeof err === 'string' && err.trim()) return err
  if (typeof err?.message === 'string' && err.message.trim()) return err.message
  if (typeof err?.error === 'string' && err.error.trim()) return err.error
  return fallback
}
function messageSignature(msg) {
  return `${msg.from || ''}|${msg.text || ''}|${msg.time || ''}`
}
function mergeSyncedMessages(existing = [], mapped = []) {
  const existingById = new Map(existing.filter((m) => m?.id).map((m) => [m.id, m]))
  const existingBySignature = new Map(existing.map((m) => [messageSignature(m), m]))

  const merged = []
  const usedLocalIds = new Set()
  const mappedSignatures = new Set()

  for (const incoming of mapped) {
    const signature = messageSignature(incoming)
    mappedSignatures.add(signature)
    const local = existingById.get(incoming.id) || existingBySignature.get(signature)
    if (local?.id) usedLocalIds.add(local.id)
    if (local?.deleted) continue

    merged.push({
      ...incoming,
      reaction: local?.reaction || '',
      replyTo: local?.replyTo || null,
      forwardedFrom: local?.forwardedFrom || null,
    })
  }

  for (const local of existing) {
    if (local?.deleted) continue
    const existsById = local?.id && usedLocalIds.has(local.id)
    const existsBySignature = mappedSignatures.has(messageSignature(local))
    if (!existsById && !existsBySignature) {
      merged.push(local)
    }
  }

  return merged
}

// ── Message bubble ────────────────────────────────────────────
function Bubble({ msg, isWA, onReply, onForward, onDelete, onReact, emojiPickerOpen, setEmojiPickerOpen }) {
  const isMe = msg.from === 'me'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`group relative max-w-[88%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
        ${isMe
          ? isWA
            ? 'bg-emerald-500 text-white rounded-tr-sm'
            : 'bg-accent-400 text-slate-950 rounded-tr-sm'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm border border-slate-100 dark:border-slate-700'
        }`}
      >
        {msg.replyTo?.text && (
          <div className={`mb-2 rounded-lg px-2.5 py-1.5 text-[11px] border-l-2
            ${isMe
              ? 'bg-white/15 border-white/60 text-white/90'
              : 'bg-slate-50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-300'}`}
          >
            <p className="font-semibold">{msg.replyTo.from === 'me' ? 'Replying to you' : 'Replying to contact'}</p>
            <p className="line-clamp-2 whitespace-pre-wrap">{msg.replyTo.text}</p>
          </div>
        )}
        <p className="whitespace-pre-wrap">{msg.text}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
          <span className="text-[10px]">{msg.time}</span>
          {isMe && (
            msg.status === 'sending' ? <Clock className="w-3 h-3" /> :
            msg.status === 'error'   ? <AlertCircle className="w-3 h-3 text-red-300" /> :
            msg.status === 'sent'    ? <Check className="w-3 h-3" /> :
                                       <CheckCheck className="w-3 h-3" />
          )}
        </div>
        {msg.reaction && (
          <div className={`mt-1.5 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <span className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full text-xs
              ${isMe ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
              {msg.reaction}
            </span>
          </div>
        )}
        <div className={`mt-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
          <button
            onClick={() => setEmojiPickerOpen(emojiPickerOpen ? null : msg.id)}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-500"
            title="React with emoji"
            aria-label="React with emoji"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onReply(msg)}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-500"
            title="Reply"
            aria-label="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onForward(msg)}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-500"
            title="Forward"
            aria-label="Forward message"
          >
            <Forward className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(msg)}
            className="p-1 rounded-md hover:bg-red-500/20 text-red-500 focus-visible:ring-2 focus-visible:ring-red-400"
            title="Delete message"
            aria-label="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {emojiPickerOpen && (
          <div className={`absolute z-10 bottom-0 translate-y-full mt-1 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-lg`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReact(msg, emoji)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function CommunicationPage() {
  const connected = useIntegrationsStore((s) => s.connected)
  const fetchIntegrations = useIntegrationsStore((s) => s.fetchIntegrations)
  const integrationsLoaded = useIntegrationsStore((s) => s.loaded)

  const [conversations, setConversations] = useState(loadConversations)
  const [history, setHistory]         = useState(loadHistory)
  const [activeId, setActiveId]       = useState(null)
  const [channelFilter, setChannelFilter] = useState('all')
  const [search, setSearch]           = useState('')
  const [dateRange, setDateRange]     = useState(emptyDateRange)
  const [message, setMessage]         = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [sending, setSending]         = useState(false)
  const [newContact, setNewContact]   = useState(false)
  const [newPhone, setNewPhone]       = useState('')
  const [newName, setNewName]         = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeChannel, setComposeChannel] = useState('email')
  const [composeRecipient, setComposeRecipient] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState(null)
  const [communicationRefreshTick, setCommunicationRefreshTick] = useState(0)
  const [allWAMessages, setAllWAMessages] = useState([])
  const messagesEndRef                = useRef(null)
  const inputRef                      = useRef(null)

  useEffect(() => {
    if (!integrationsLoaded) {
      fetchIntegrations()
    }
  }, [fetchIntegrations, integrationsLoaded])

  useEffect(() => {
    const handleRealtimeNotification = (event) => {
      const incoming = event?.detail || {}
      const type = String(incoming.type || incoming.entityType || '').toLowerCase()
      const actionUrl = String(incoming.actionUrl || incoming.action_url || '')
      if (type === 'communication' || actionUrl.includes('/communication')) {
        setCommunicationRefreshTick((tick) => tick + 1)
      }
    }
    window.addEventListener('nexacrm:notification', handleRealtimeNotification)
    return () => window.removeEventListener('nexacrm:notification', handleRealtimeNotification)
  }, [])

  const isChannelConnected = (channel) => {
    if (channel === 'email' || channel === 'whatsapp') {
      return true
    }
    return !!connected[channel]
  }

  const whatsappEnabled = isChannelConnected('whatsapp')

  const allConvs = conversations

  const filtered = allConvs.filter((c) => {
    const matchChannel = channelFilter === 'all' || c.channel === channelFilter
    const matchSearch  = anyFieldMatchesSearch(search, [c.name, c.phone, c.email, c.recipient, c.company])
    const messages = history[c.id] || []
    const latest = messages.length ? messages[messages.length - 1] : null
    const matchDate = !hasDateRangeFilter(dateRange) || isWithinDateRange(latest?.createdAt, dateRange)
    return matchChannel && matchSearch && matchDate
  })

  const activeConv = allConvs.find((c) => c.id === activeId) || null
  const isWA = activeConv?.channel === 'whatsapp'

  // Messages for active conversation
  const convMessages = activeId
    ? (history[activeId] || [])
    : []
  const visibleMessages = convMessages.filter((m) => !m.deleted && isWithinDateRange(m.createdAt, dateRange))
  const visibleWAMessages = allWAMessages.filter((msg) => isWithinDateRange(msg.createdAt, dateRange))

  // Last message preview
  function lastMsg(conv) {
    const msgs = (history[conv.id] || []).filter((m) => !m.deleted)
    if (msgs.length > 0) return msgs[msgs.length - 1].text
    if (conv.lastMessage) return conv.lastMessage
    return 'No messages yet'
  }

  function unreadCount(conv) {
    const msgs = (history[conv.id] || []).filter((m) => !m.deleted)
    return msgs.filter((m) => m.from === 'lead' && !m.read).length || (conv.unread || 0)
  }

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleMessages.length, activeId])

  // Persist history
  useEffect(() => { saveHistory(history) }, [history])
  useEffect(() => { saveConversations(conversations) }, [conversations])
  useEffect(() => {
    if (activeId && !conversations.some((c) => c.id === activeId)) {
      setActiveId(null)
    }
  }, [activeId, conversations])
  useEffect(() => {
    setReplyToMessage(null)
    setEmojiPickerMessageId(null)
  }, [activeId])

  useEffect(() => {
    let cancelled = false
    const syncConversations = async () => {
      try {
        const rows = await commsAPI.getWhatsAppConversations()
        if (cancelled) return
        setConversations((prev) => {
          const existing = new Map(prev.map((c) => [c.id, c]))
          const backendWhatsapp = rows.map((row) => {
            const contact = cleanPhone(row.contact || '')
            const id = convIdForWhatsApp(contact)
            const displayName = String(row.name || '').trim()
            return {
              id,
              name: displayName || `+${contact}`,
              phone: `+${contact}`,
              recipient: contact,
              company: 'WhatsApp',
              channel: 'whatsapp',
              unread: 0,
            }
          })

          // Upsert backend conversations without deleting local ones.
          for (const conv of backendWhatsapp) {
            const previous = existing.get(conv.id) || {}
            existing.set(conv.id, { ...previous, ...conv, name: bestConversationName(previous, conv) })
          }

          // Keep all local chats; backend sync should enrich, not replace.
          return Array.from(existing.values())
        })
      } catch {
        // keep local conversations when backend is unreachable
      }
    }

    syncConversations()
    const timer = setInterval(syncConversations, 7000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [communicationRefreshTick])

  // Fetch all WhatsApp messages for the unified panel
  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      try {
        const rows = await commsAPI.getAllWhatsAppMessages()
        if (cancelled) return
        setAllWAMessages(rows.reverse())
      } catch { /* ignore */ }
    }
    fetchAll()
    const timer = setInterval(fetchAll, 8000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [communicationRefreshTick])

  useEffect(() => {
    if (!activeConv || activeConv.channel !== 'whatsapp') return
    const contact = cleanPhone(activeConv.recipient || activeConv.phone || activeConv.name)
    if (!contact) return

    let cancelled = false
    const syncMessages = async () => {
      try {
        const rows = await commsAPI.getWhatsAppMessages(contact)
        if (cancelled) return
        const mapped = rows.map((row) => ({
          id: `db-${row.id ?? `${contact}-${row.createdAt}`}`,
          from: String(row.direction || '').toUpperCase() === 'IN' ? 'lead' : 'me',
          text: row.body || '',
          createdAt: row.createdAt,
          time: formatMessageTime(row.createdAt),
          status: String(row.direction || '').toUpperCase() === 'IN'
            ? 'read'
            : (String(row.status || '').toUpperCase() === 'SENT' ? 'delivered' : 'sent'),
        }))
        setHistory((prev) => {
          const existing = prev[activeConv.id] || []
          return { ...prev, [activeConv.id]: mergeSyncedMessages(existing, mapped) }
        })
      } catch {
        // keep local fallback when sync fails
      }
    }

    syncMessages()
    const timer = setInterval(syncMessages, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activeConv?.id, activeConv?.channel, activeConv?.recipient, activeConv?.phone, activeConv?.name, communicationRefreshTick])



  // Send message
  async function handleSend() {
    const text = message.trim()
    if (!text) return
    if (!activeConv) return

    const tempId = `msg-${Date.now()}`
    const tempMsg = {
      id: tempId,
      from: 'me',
      text,
      createdAt: new Date().toISOString(),
      time: nowTime(),
      status: 'sending',
      replyTo: replyToMessage ? { ...replyToMessage } : null,
    }
    const initialThread = history[activeConv.id] ?? []

    setHistory((prev) => ({
      ...prev,
      [activeConv.id]: [...initialThread, tempMsg],
    }))
    setMessage('')
    setReplyToMessage(null)
    setEmojiPickerMessageId(null)
    setSending(true)

    if (isWA) {
      const phone = cleanPhone(activeConv.phone || activeConv.id)
      try {
        await commsAPI.sendChannel({
          channel: 'whatsapp',
          recipient: phone,
          subject: '',
          body: text,
        })
        setHistory((prev) => ({
          ...prev,
          [activeConv.id]: (prev[activeConv.id] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'delivered' } : m
          ),
        }))
        toast.success(`Sent to ${activeConv.name} on WhatsApp`)
      } catch (err) {
        setHistory((prev) => ({
          ...prev,
          [activeConv.id]: (prev[activeConv.id] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'error' } : m
          ),
        }))
        toast.error(getErrorMessage(err, 'Failed to send WhatsApp message'))
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    } else {
      const channel = activeConv.channel
      const recipient = channel === 'email'
        ? String(activeConv.email || activeConv.recipient || '').trim()
        : String(activeConv.recipient || activeConv.phone || activeConv.name || '').trim()

      if (!recipient) {
        setHistory((prev) => ({
          ...prev,
          [activeConv.id]: (prev[activeConv.id] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'error' } : m
          ),
        }))
        setSending(false)
        toast.error('Recipient is missing for this conversation.')
        inputRef.current?.focus()
        return
      }

      if (!isChannelConnected(channel)) {
        setHistory((prev) => ({
          ...prev,
          [activeConv.id]: (prev[activeConv.id] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'error' } : m
          ),
        }))
        setSending(false)
        toast.error(`Connect ${channel} in Integrations page first.`)
        inputRef.current?.focus()
        return
      }

      try {
        await commsAPI.sendChannel({
          channel,
          recipient,
          subject: `Internite CRM follow-up: ${activeConv.name}`,
          body: text,
        })
        setHistory((prev) => ({
          ...prev,
          [activeConv.id]: (prev[activeConv.id] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'delivered' } : m
          ),
        }))
        toast.success(`${CHANNEL_CONFIG[channel]?.label || channel} message sent to ${activeConv.name}`)
      } catch (err) {
        setHistory((prev) => ({
          ...prev,
          [activeConv.id]: (prev[activeConv.id] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'error' } : m
          ),
        }))
        toast.error(getErrorMessage(err, 'Failed to send message'))
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    }
  }

  // AI suggestion
  function getAISuggestion() {
    setAiSuggestion(AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)])
  }

  function handleReplyMessage(msg) {
    setReplyToMessage({
      id: msg.id,
      text: msg.text,
      from: msg.from,
    })
    setEmojiPickerMessageId(null)
    inputRef.current?.focus()
  }

  function handleForwardMessage(msg) {
    const defaultChannel = activeConv?.channel || 'email'
    const defaultRecipient = String(
      activeConv?.recipient || activeConv?.phone || activeConv?.email || ''
    ).trim()

    setComposeChannel(defaultChannel)
    setComposeRecipient(defaultRecipient)
    setComposeSubject(defaultChannel === 'email' ? `Fwd: Message from ${activeConv?.name || 'conversation'}` : '')
    setComposeBody(`Forwarded message:\n${msg.text}`)
    setComposeOpen(true)
    setEmojiPickerMessageId(null)
  }

  function updateActiveMessage(messageId, updater) {
    if (!activeId) return
    setHistory((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] || []).map((m) => (m.id === messageId ? updater(m) : m)),
    }))
  }

  function handleDeleteMessage(msg) {
    updateActiveMessage(msg.id, (current) => ({ ...current, deleted: true }))
    if (replyToMessage?.id === msg.id) {
      setReplyToMessage(null)
    }
    setEmojiPickerMessageId(null)
    toast.success('Message deleted')
  }

  function handleMessageReaction(msg, emoji) {
    updateActiveMessage(msg.id, (current) => ({
      ...current,
      reaction: current.reaction === emoji ? '' : emoji,
    }))
    setEmojiPickerMessageId(null)
  }

  // Start new WA conversation
  function startNewConversation() {
    const phone = cleanPhone(newPhone)
    const name = newName.trim()
    if (!phone || !name) { toast.error('Enter name and phone number'); return }

    const convId = convIdForWhatsApp(phone)
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === convId)
      if (exists) return prev
      return [
        {
          id: convId,
          name,
          phone: newPhone.trim(),
          recipient: phone,
          company: '',
          channel: 'whatsapp',
          unread: 0,
        },
        ...prev,
      ]
    })

    setActiveId(convId)
    setNewContact(false)
    setNewPhone('')
    setNewName('')
    toast.success(`Conversation started with ${name}`)
  }

  async function sendComposedMessage() {
    const channel = composeChannel
    const recipient = composeRecipient.trim()
    const body = composeBody.trim()
    const subject = composeSubject.trim()

    if (!recipient) {
      toast.error('Recipient is required.')
      return
    }
    if (!body) {
      toast.error('Message is required.')
      return
    }
    if (channel === 'email' && !recipient.includes('@')) {
      toast.error('Enter a valid email recipient.')
      return
    }
    if (channel !== 'whatsapp' && !isChannelConnected(channel)) {
      toast.error(`Connect ${channel} in Integrations page first.`)
      return
    }

    setComposeSending(true)
    try {
      await commsAPI.sendChannel({
        channel,
        recipient,
        subject: subject || `Internite CRM outbound: ${channel.toUpperCase()}`,
        body,
      })

      const safeRecipient = recipient.toLowerCase().replace(/[^a-z0-9]/g, '')
      const convId = channel === 'whatsapp'
        ? convIdForWhatsApp(recipient)
        : `${channel}-manual-${safeRecipient || Date.now()}`

      setConversations((prev) => {
        const exists = prev.find((c) => c.id === convId)
        if (exists) return prev
        return [
          {
            id: convId,
            name: recipient,
            email: channel === 'email' ? recipient : undefined,
            phone: channel === 'whatsapp' ? recipient : undefined,
            recipient,
            channel,
            company: 'Manual',
            unread: 0,
          },
          ...prev,
        ]
      })

      setHistory((prev) => ({
        ...prev,
        [convId]: [
          ...(prev[convId] || []),
          { id: `msg-${Date.now()}`, from: 'me', text: body, time: nowTime(), status: 'delivered' },
        ],
      }))

      setActiveId(convId)
      setComposeOpen(false)
      setComposeBody('')
      setComposeRecipient('')
      setComposeSubject('')
      toast.success(`${CHANNEL_CONFIG[channel]?.label || channel} message sent`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send message'))
    } finally {
      setComposeSending(false)
    }
  }

  const TABS = [
    { key: 'all',       label: 'All' },
    { key: 'whatsapp',  label: 'WhatsApp' },
    { key: 'email',     label: 'Email' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Messages<InfoHint text="Unified inbox — WhatsApp & Email" /></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-accent-400 hover:bg-accent-500 text-slate-950 transition-colors"
          >
            <SquarePen className="w-3.5 h-3.5" /> New Message
          </button>
          {whatsappEnabled ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl">
              <Phone className="w-3.5 h-3.5" /> WhatsApp Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5" /> WhatsApp not configured
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[520px] lg:h-[calc(100vh-180px)]">

        {/* ── Sidebar ── */}
        <div className="w-full lg:w-72 glass-card flex flex-col overflow-hidden lg:flex-shrink-0 max-h-[360px] lg:max-h-none">
          {/* Search */}
          <div className="p-3 border-b border-slate-200/60 dark:border-slate-700/40 space-y-2">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, company, or email..."
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none flex-1"
              />
            </div>
            <DateRangeFilter value={dateRange} onChange={setDateRange} compact />
            {/* New WA conversation */}
            {whatsappEnabled && (
              <button
                onClick={() => setNewContact(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New WhatsApp Chat
              </button>
            )}
          </div>

          {/* Channel tabs */}
          <div className="flex overflow-x-auto px-2 pt-2 gap-1 flex-shrink-0 custom-scrollbar">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setChannelFilter(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors flex-shrink-0
                  ${channelFilter === tab.key
                    ? 'bg-accent-400 text-slate-950'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100/60 dark:divide-slate-700/30 mt-1 min-h-0">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No conversations</p>
            ) : filtered.map((conv) => {
              const cfg = CHANNEL_CONFIG[conv.channel]
              const Icon = cfg?.icon
              const isActive = activeId === conv.id
              const unread = unreadCount(conv)
              return (
                <button key={conv.id} onClick={() => setActiveId(conv.id)}
                  className={`w-full flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left
                    ${isActive ? 'bg-brand-50/60 dark:bg-brand-950/20 border-l-2 border-brand-500' : ''}`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-bold text-sm">
                      {conv.name.charAt(0)}
                    </div>
                    {/* Online status dot */}
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-[1.5px] border-white dark:border-slate-900 shadow-sm" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${cfg?.bg} flex items-center justify-center border-2 border-white dark:border-slate-900`}>
                      {Icon && <Icon className={`w-2.5 h-2.5 ${cfg?.color}`} />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{conv.name}</p>
                      {conv.phone && (
                        <span className="max-w-[120px] flex-shrink-0 truncate text-[9px] text-slate-400">{conv.phone}</span>
                      )}
                    </div>
                    {conv.company && <p className="text-[10px] text-slate-400 mb-0.5">{conv.company}</p>}
                    <p className="text-xs text-slate-500 truncate">{lastMsg(conv)}</p>
                  </div>
                  {unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-1">
                      {unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── All WhatsApp Messages Panel ── */}
        {!activeConv && (
          <div className="flex-1 glass-card flex flex-col overflow-hidden min-h-[420px] lg:min-h-0">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/10 dark:to-slate-900">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                <Phone className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">All WhatsApp Messages</p>
                <p className="text-[11px] text-slate-500">{visibleWAMessages.length} messages across all contacts</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {visibleWAMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                  <Phone className="w-12 h-12 opacity-30" />
                  <p className="text-sm">No WhatsApp messages yet</p>
                  <p className="text-xs text-center max-w-xs">Pick a chat or start a new one.</p>
                </div>
              ) : (
                visibleWAMessages.map((msg) => {
                  const isIn = String(msg.direction || '').toUpperCase() === 'IN'
                  const contactLabel = msg.contactName || msg.contact || 'Unknown'
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
                        ${isIn
                          ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm border border-slate-100 dark:border-slate-700'
                          : 'bg-emerald-500 text-white rounded-tr-sm'}`}
                      >
                        <p className={`text-[10px] font-semibold mb-1 ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-white/70'}`}>
                          {isIn ? contactLabel : 'You'} {isIn ? '' : `→ ${contactLabel}`}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${isIn ? 'text-slate-400' : 'text-white/60'}`}>
                          <span className="text-[10px]">{formatMessageTime(msg.createdAt)}</span>
                          {!isIn && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Chat Window ── */}
        {activeConv && (
          <div className="flex-1 glass-card flex flex-col overflow-hidden min-h-[420px] lg:min-h-0">
            <>
              {/* Chat header */}
              <div className={`flex flex-wrap items-start justify-between gap-2 px-3 sm:px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-700/40
                ${isWA ? 'bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/10 dark:to-slate-900' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-bold text-sm">
                      {activeConv.name.charAt(0)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 shadow-sm" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{activeConv.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Online
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className={`text-[10px] font-semibold ${CHANNEL_CONFIG[activeConv.channel]?.color}`}>
                        via {CHANNEL_CONFIG[activeConv.channel]?.label}
                      </span>
                      {activeConv.phone && (
                        <CopyableContact
                          value={activeConv.phone}
                          label="Phone"
                          className="max-w-[140px] text-[10px] text-slate-400"
                        />
                      )}
                      {activeConv.company && (
                        <span className="text-[10px] text-slate-400">· {activeConv.company}</span>
                      )}
                    </div>
                  </div>
                </div>
                {isWA && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                    Send Only
                  </span>
                )}
              </div>

              {/* Messages area */}
              <div className={`flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-3
                ${isWA ? 'bg-[url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3C/svg%3E")]' : ''}`}
                style={isWA ? { background: 'linear-gradient(135deg, rgba(236,253,245,0.3) 0%, rgba(255,255,255,0) 100%)' } : {}}
              >
                {visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                    {isWA ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                          <Phone className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="font-medium text-sm text-slate-700 dark:text-slate-200">Start a WhatsApp conversation</p>
                        <p className="text-xs text-center max-w-xs leading-relaxed">
                          Type a message below to send to <strong>{activeConv.name}</strong> at {activeConv.phone}
                        </p>
                        <div className="mt-1 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 max-w-xs text-left">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>Replies show here once your webhook is connected.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-12 h-12 opacity-30" />
                        <p className="text-sm">No messages yet</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {visibleMessages.map((msg) => (
                      <Bubble
                        key={msg.id}
                        msg={msg}
                        isWA={isWA}
                        onReply={handleReplyMessage}
                        onForward={handleForwardMessage}
                        onDelete={handleDeleteMessage}
                        onReact={handleMessageReaction}
                        emojiPickerOpen={emojiPickerMessageId === msg.id}
                        setEmojiPickerOpen={setEmojiPickerMessageId}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* AI suggestion banner */}
              <AnimatePresence>
                {aiSuggestion && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="mx-4 mb-2 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/40"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                        <SarathiMark className="w-3 h-3" strokeWidth={2.2} /> Sarathi suggests
                      </p>
                      <button onClick={() => setAiSuggestion('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{aiSuggestion}</p>
                    <button
                      onClick={() => { setMessage(aiSuggestion); setAiSuggestion(''); inputRef.current?.focus() }}
                      className="mt-1.5 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                    >
                      Use this reply →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input bar */}
              <div className={`relative p-3 border-t border-slate-200/60 dark:border-slate-700/40 flex items-end gap-2
                ${isWA ? 'bg-emerald-50/30 dark:bg-emerald-950/5' : ''}`}>
                {replyToMessage && (
                  <div className="absolute left-3 right-3 -top-[58px] sm:-top-[54px] p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-brand-600 dark:text-brand-400">
                          Replying to {replyToMessage.from === 'me' ? 'your message' : activeConv.name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{replyToMessage.text}</p>
                      </div>
                      <button
                        onClick={() => setReplyToMessage(null)}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                <button onClick={getAISuggestion}
                  className="p-2.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-950/20 text-brand-500 transition-colors flex-shrink-0"
                  title="Ask Sarathi for a reply">
                  <SarathiMark className="w-4 h-4" />
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder={isWA ? `Message ${activeConv.name} via WhatsApp…` : 'Type a message… (Enter to send, Shift+Enter for new line)'}
                  className="input flex-1 resize-none min-h-[40px] max-h-[120px] py-2.5"
                  style={{ height: '40px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className={`p-2.5 rounded-xl flex-shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${isWA
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-accent-400 hover:bg-accent-500 text-slate-950'}`}
                  title="Send message"
                >
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          </div>
        )}
      </div>

      {/* ── New Contact Modal ── */}
      <AnimatePresence>
        {composeOpen && (
          <ScreenModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create message">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setComposeOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg z-10 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Create Message</h3>
                <button onClick={() => setComposeOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Channel</label>
                <select
                  value={composeChannel}
                  onChange={(e) => setComposeChannel(e.target.value)}
                  className="input w-full"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              {/* Per-channel recipient config */}
              {(() => {
                const cfg = {
                  email:     { label: 'Recipient Email',              placeholder: 'name@example.com',            hint: null },
                  whatsapp:  { label: 'WhatsApp Number',              placeholder: '919876543210 (with country code)', hint: 'Include country code, no +, dashes, or spaces.' },
                }[composeChannel] || { label: 'Recipient', placeholder: 'Recipient identifier', hint: null }
                return (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">{cfg.label}</label>
                    <input
                      value={composeRecipient}
                      onChange={(e) => setComposeRecipient(e.target.value)}
                      placeholder={cfg.placeholder}
                      className="input w-full"
                    />
                    {cfg.hint && (
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{cfg.hint}</p>
                    )}
                  </div>
                )
              })()}

              {/* Channel not connected warning */}
              {composeChannel !== 'email' && composeChannel !== 'whatsapp' && !isChannelConnected(composeChannel) && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-3 py-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{CHANNEL_CONFIG[composeChannel]?.label}</strong> is not connected.{' '}
                    Connect it in <strong>Integrations</strong> first, or the message will fail to send.
                  </span>
                </div>
              )}

              {composeChannel === 'email' && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Subject</label>
                  <input
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    className="input w-full"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Message</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={5}
                  placeholder="Write your message..."
                  className="input w-full resize-none"
                />
              </div>

              <button
                onClick={sendComposedMessage}
                disabled={composeSending}
                className="w-full py-2.5 rounded-xl bg-accent-400 hover:bg-accent-500 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-60"
              >
                {composeSending ? 'Sending...' : 'Send Message'}
              </button>
            </motion.div>
            </div>
          </ScreenModalPortal>
        )}
        {newContact && (
          <ScreenModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New WhatsApp chat">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNewContact(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">New WhatsApp Chat</h3>
                <button onClick={() => setNewContact(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Name</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contact name" className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">WhatsApp Number</label>
                  <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="919876543210 (with country code)" className="input w-full" />
                </div>
                <button onClick={startNewConversation}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors">
                  Start Chat
                </button>
              </div>
            </motion.div>
            </div>
          </ScreenModalPortal>
        )}
      </AnimatePresence>
    </div>
  )
}
