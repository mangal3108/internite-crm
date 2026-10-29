import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, Clock, Phone, Trophy, ChevronRight, ChevronDown, History } from 'lucide-react'
import toast from 'react-hot-toast'
import ScreenModalPortal from './ui/ScreenModalPortal'

/* ── Activity definitions — 3-step workflow ── */
const ACTIVITIES = [
  {
    id: 'act01',
    label: 'Activity 01',
    title: 'Welcome Call',
    description: 'Call the client — if connected, check interest; if not, schedule follow-up',
    hours: 1,
    icon: Phone,
    color: { bg: '#fff0f0', border: '#fca5a5', header: '#ef4444', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', step: 'bg-red-500' },
  },
  {
    id: 'act02',
    label: 'Activity 02',
    title: 'Follow Up for Meeting',
    description: 'Follow up with the client to schedule a meeting',
    hours: 2,
    icon: Clock,
    color: { bg: '#eff6ff', border: '#93c5fd', header: '#3b82f6', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', step: 'bg-blue-500' },
  },
  {
    id: 'act03',
    label: 'Activity 03',
    title: 'Meeting Outcome',
    description: 'Record the meeting outcome — Won, Lost, or Negotiation',
    hours: null,
    icon: Trophy,
    color: { bg: '#f0fdf4', border: '#86efac', header: '#16a34a', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', step: 'bg-green-500' },
  },
]

const normalizeActivityTab = (value) => {
  const index = Number(value)
  if (!Number.isInteger(index)) return 0
  if (index < 0) return 0
  if (index >= ACTIVITIES.length) return ACTIVITIES.length - 1
  return index
}

const normalizeOutcome = (value) => String(value || '').trim().toLowerCase()

const canonicalConnectionStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'connected') return 'Connected'
  if (normalized === 'callback' || normalized === 'call back' || normalized === 'call-back' || normalized === 'callback requested') return 'CallBack'
  if (['not connected', 'non connected', 'no answer', 'busy', 'callback requested', 'wrong number'].includes(normalized)) {
    return 'Not Connected'
  }
  return ''
}

const canonicalInterestStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'interested') return 'Interested'
  if (normalized === 'not interested' || normalized === 'not_interested') return 'Not Interested'
  return ''
}

const canonicalActivityTwoStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'allowed person for meeting' || normalized === 'allowed person' || normalized === 'allowed_person') return 'Allowed Person for Meeting'
  if (normalized === 'meeting') return 'Allowed Person for Meeting'
  if (normalized === 'follow up' || normalized === 'follow-up' || normalized === 'followup') return 'Follow Up'
  if (normalized === 'lost' || normalized === 'close lost' || normalized === 'closed lost') return 'Lost'
  return ''
}

const canonicalActivityThreeStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'won' || normalized === 'win' || normalized === 'closed won') return 'Won'
  if (normalized === 'lost' || normalized === 'close lost' || normalized === 'closed lost') return 'Lost'
  if (normalized === 'negotiation') return 'Negotiation'
  return ''
}

const formatDateTime = (value) => {
  if (!value) return 'Auto'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const computeDelayMeta = (plannedValue, actualValue) => {
  const planned = new Date(plannedValue)
  const actual = new Date(actualValue)
  if (Number.isNaN(planned.getTime()) || Number.isNaN(actual.getTime())) {
    return { label: 'Auto', status: 'On Time' }
  }

  const diffMs = actual.getTime() - planned.getTime()
  const hours = Math.abs(diffMs) / (1000 * 60 * 60)
  const rounded = hours.toFixed(1)

  if (Math.abs(diffMs) < 60 * 1000) {
    return { label: '0.0 hrs', status: 'On Time' }
  }
  if (diffMs > 0) {
    return { label: `${rounded} hrs`, status: 'Delayed' }
  }
  return { label: `${rounded} hrs`, status: 'Early' }
}

const humanizeLabel = (value) => {
  const text = String(value || '').replace(/_/g, ' ').trim()
  if (!text) return '—'
  return text
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const ACTIVITY_TITLE_BY_INDEX = ['Welcome Call', 'Follow Up for Meeting', 'Meeting Outcome']

const ACTIVITY_TITLE_KEYWORDS = [
  ['welcome', 'call', 'activity 01', 'act01'],
  ['follow up', 'follow-up', 'followup', 'activity 02', 'act02'],
  ['meeting outcome', 'outcome', 'activity 03', 'act03'],
]

const parseActivityLogs = (logs, activityIndex) => {
  if (!Array.isArray(logs) || logs.length === 0) return []
  const keywords = ACTIVITY_TITLE_KEYWORDS[activityIndex] || []
  return logs
    .map(entry => {
      const parts = String(entry).split(' | ')
      if (parts.length < 2) return null
      const [timestamp, actTitle, ...rest] = parts
      const lower = (actTitle || '').toLowerCase()
      const matches = keywords.some(kw => lower.includes(kw))
      if (!matches) return null
      return { timestamp, title: actTitle, summary: rest.join(' · ') || 'Activity recorded' }
    })
    .filter(Boolean)
}

function ActivityHistory({ logs, activityIndex }) {
  const [open, setOpen] = useState(false)
  const entries = parseActivityLogs(logs, activityIndex)

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition"
      >
        <span className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          Activity History ({entries.length})
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {entries.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">No history yet</p>
          )}
          {entries.map((entry, i) => (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {formatDateTime(entry.timestamp)}
              </p>
              <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{entry.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LeadActivitiesModal({ lead, onClose, onPersist, initialData, initialSaved, initialActiveTab = 0, onActiveTabChange }) {
  const [activeTab, setActiveTab] = useState(() => normalizeActivityTab(initialActiveTab))
  const [saved, setSaved] = useState(initialSaved || [false, false, false])
  const [data, setData] = useState(initialData || [{},{},{}])
  const [saving, setSaving] = useState(false)
  const leadIdRef = useRef(lead?.id)
  const onTabChangeRef = useRef(onActiveTabChange)
  onTabChangeRef.current = onActiveTabChange

  useEffect(() => {
    if (leadIdRef.current === lead?.id) return
    leadIdRef.current = lead?.id
    setActiveTab(normalizeActivityTab(initialActiveTab))
    setSaved(initialSaved || [false, false, false])
    setData(initialData || [{},{},{}])
  }, [lead?.id, initialActiveTab, initialData, initialSaved])

  useEffect(() => {
    onTabChangeRef.current?.(lead?.id, activeTab)
  }, [activeTab, lead?.id])

  const act = ACTIVITIES[activeTab] || ACTIVITIES[0]
  const Icon = act.icon
  const currentActivityData = data[activeTab] || {}

  /* ── Activity 01 computed values ── */
  const activityOneValues = data[0] || {}
  const activityOneConnectionStatus = canonicalConnectionStatus(activityOneValues.connectionStatus || activityOneValues.callOutcome || activityOneValues.status)
  const activityOneInterestStatus = canonicalInterestStatus(activityOneValues.interestStatus || activityOneValues.interest)
  const isConnected = normalizeOutcome(activityOneConnectionStatus) === 'connected'
  const isNotConnected = normalizeOutcome(activityOneConnectionStatus) === 'not connected'
  const isCallBack = normalizeOutcome(activityOneConnectionStatus) === 'callback'
  const needsActivityOneFollowUp = isNotConnected || isCallBack
  const isInterested = normalizeOutcome(activityOneInterestStatus) === 'interested'
  const isNotInterested = normalizeOutcome(activityOneInterestStatus) === 'not interested'
  const leadSource = humanizeLabel(lead?.source || activityOneValues.source)
  const serviceRequirement = humanizeLabel(lead?.service || lead?.specialization || activityOneValues.serviceRequirement)
  const plannedDate = lead?.createdAt || activityOneValues.plannedDate || lead?.followUpDate || null
  const actualDate = new Date().toISOString()
  const delayMeta = computeDelayMeta(plannedDate, actualDate)
  const assignedTeamMember = humanizeLabel(lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || activityOneValues.assignedTo || 'Auto assigned')
  const remarksValue = activityOneValues.remark || activityOneValues.remarks || activityOneValues.note || ''

  /* ── Activity 02 computed values ── */
  const activityTwoValues = data[1] || {}
  const activityTwoStatus = canonicalActivityTwoStatus(activityTwoValues.status)
  const activityTwoPlannedDate = activityOneValues.actualDate || activityOneValues.actual || activityOneValues.savedAt || lead?.followUpDate || lead?.createdAt || null
  const activityTwoActualDate = new Date().toISOString()
  const activityTwoDelayMeta = computeDelayMeta(activityTwoPlannedDate, activityTwoActualDate)
  const activityTwoAssignedTeamMember = humanizeLabel(activityOneValues.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || 'Auto assigned')
  const activityTwoRemark = activityTwoValues.remark || activityTwoValues.remarks || activityTwoValues.note || ''
  const isActivityTwoFollowUp = normalizeOutcome(activityTwoStatus) === 'follow up'
  const isActivityTwoAllowedPerson = normalizeOutcome(activityTwoStatus) === 'allowed person for meeting'
  const isActivityTwoLost = normalizeOutcome(activityTwoStatus) === 'lost'
  const activityTwoPersonName = activityTwoValues.personName || ''
  const activityTwoPersonDesignation = activityTwoValues.personDesignation || ''
  const activityTwoMeetingDate = activityTwoValues.meetingDate || ''
  const activityTwoMeetingMode = activityTwoValues.meetingMode || ''

  /* ── Activity 03 computed values ── */
  const activityThreeValues = data[2] || {}
  const activityThreeStatus = canonicalActivityThreeStatus(activityThreeValues.status)
  const activityThreePlannedDate = activityTwoValues.actualDate || activityTwoValues.actual || activityTwoValues.savedAt || activityTwoValues.plannedDate || lead?.createdAt || null
  const activityThreeActualDate = new Date().toISOString()
  const activityThreeDelayMeta = computeDelayMeta(activityThreePlannedDate, activityThreeActualDate)
  const activityThreeAssignedTeamMember = humanizeLabel(activityTwoValues.assignedTo || activityOneValues.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || 'Auto assigned')
  const activityThreeMeetingPriceFinal = activityThreeValues.meetingPriceFinal || ''
  const activityThreePaymentReceived = activityThreeValues.paymentReceived || ''
  const activityThreeLostCategory = activityThreeValues.lostCategory || ''
  const activityThreeRemark = activityThreeValues.remark || activityThreeValues.remarks || activityThreeValues.note || ''
  const activityThreeRemarkWon = activityThreeValues.remarkWon || activityThreeRemark
  const activityThreeRemarkLost = activityThreeValues.remarkLost || activityThreeRemark
  const isActivityThreeWon = normalizeOutcome(activityThreeStatus) === 'won'
  const isActivityThreeLost = normalizeOutcome(activityThreeStatus) === 'lost'
  const isActivityThreeNegotiation = normalizeOutcome(activityThreeStatus) === 'negotiation'

  const updateField = (key, val) => {
    setData(prev => {
      const next = [...prev]
      next[activeTab] = { ...next[activeTab], [key]: val }
      return next
    })
  }

  const patchCurrentActivity = (patch) => {
    setData(prev => {
      const next = [...prev]
      next[activeTab] = { ...next[activeTab], ...patch }
      return next
    })
  }

  const handleSave = async () => {
    /* ── Activity 01 validation ── */
    if (activeTab === 0) {
      if (!activityOneConnectionStatus) {
        toast.error('Please select Connected, Not Connected, or CallBack.')
        return false
      }
      if (needsActivityOneFollowUp && !String(activityOneValues.nextFollowUpDate || activityOneValues.followUpDate || '').trim()) {
        toast.error('Please select a follow-up date.')
        return false
      }
      if (isConnected && !activityOneInterestStatus) {
        toast.error('Please select Interested or Not Interested.')
        return false
      }
    }
    /* ── Activity 02 validation ── */
    if (activeTab === 1) {
      if (!activityTwoStatus) {
        toast.error('Please select a status.')
        return false
      }
      if (isActivityTwoFollowUp && !String(activityTwoValues.nextFollowUpDate || activityTwoValues.followUpDate || '').trim()) {
        toast.error('Please select a next follow-up date.')
        return false
      }
      if (isActivityTwoAllowedPerson) {
        if (!String(activityTwoPersonName).trim()) {
          toast.error('Please enter the person name.')
          return false
        }
        if (!String(activityTwoPersonDesignation).trim()) {
          toast.error('Please enter the designation.')
          return false
        }
        if (!String(activityTwoMeetingDate).trim()) {
          toast.error('Please select the meeting date.')
          return false
        }
        if (!String(activityTwoMeetingMode).trim()) {
          toast.error('Please select the meeting mode.')
          return false
        }
      }
    }
    /* ── Activity 03 validation ── */
    if (activeTab === 2) {
      if (!activityThreeStatus) {
        toast.error('Please select a status for Activity 03.')
        return false
      }
      if (isActivityThreeLost && !String(activityThreeLostCategory).trim()) {
        toast.error('Please select a lost category.')
        return false
      }
      if (isActivityThreeNegotiation && !String(activityThreeValues.nextFollowUpDate || activityThreeValues.followUpDate || '').trim()) {
        toast.error('Please select a next follow-up date for negotiation.')
        return false
      }
      if (isActivityThreeWon) {
        if (!String(activityThreeMeetingPriceFinal).trim()) {
          toast.error('Please enter the meeting price final.')
          return false
        }
        if (!String(activityThreePaymentReceived).trim()) {
          toast.error('Please select payment received yes or no.')
          return false
        }
      }
    }

    setSaving(true)
    try {
      if (onPersist) {
        await onPersist({
          lead,
          activityIndex: activeTab,
          activity: act,
          values: data[activeTab] || {},
          allValues: data,
        })
      }
      setSaved(prev => { const n=[...prev]; n[activeTab]=true; return n })
      toast.success(`${act.label} saved`)
      return true
    } catch (err) {
      toast.error(err?.message || 'Failed to save activity')
      return false
    } finally {
      setSaving(false)
    }
  }

  const isComplete = (idx) => saved[idx]

  /* ── Activity 01 handlers ── */
  const handleActivityOneChange = (key, val) => {
    if (key === 'connectionStatus') {
      patchCurrentActivity({
        connectionStatus: val,
        callOutcome: val,
        // Reset interest when switching connection status
        ...(normalizeOutcome(val) !== 'connected' ? { interestStatus: '', interest: '', nextFollowUpDate: '', followUpDate: '', nextFollowUpTime: '' } : { nextFollowUpDate: '', followUpDate: '', nextFollowUpTime: '' }),
      })
      return
    }
    if (key === 'interestStatus') {
      patchCurrentActivity({ interestStatus: val, interest: val })
      return
    }
    if (key === 'nextFollowUpDate') {
      patchCurrentActivity({ nextFollowUpDate: val, followUpDate: val })
      return
    }
    if (key === 'remark') {
      patchCurrentActivity({ remark: val, remarks: val })
      return
    }
    updateField(key, val)
  }

  /* ── Activity 02 handlers ── */
  const handleActivityTwoChange = (key, val) => {
    if (key === 'status') {
      patchCurrentActivity({
        status: val,
        remark: '',
        remarks: '',
        note: '',
        nextFollowUpDate: normalizeOutcome(val) === 'follow up' ? (activityTwoValues.nextFollowUpDate || '') : '',
        followUpDate: normalizeOutcome(val) === 'follow up' ? (activityTwoValues.nextFollowUpDate || '') : '',
        nextFollowUpTime: normalizeOutcome(val) === 'follow up' ? (activityTwoValues.nextFollowUpTime || '') : '',
        personName: normalizeOutcome(val) === 'allowed person for meeting' ? (activityTwoValues.personName || '') : '',
        personDesignation: normalizeOutcome(val) === 'allowed person for meeting' ? (activityTwoValues.personDesignation || '') : '',
        meetingDate: normalizeOutcome(val) === 'allowed person for meeting' ? (activityTwoValues.meetingDate || '') : '',
        meetingMode: normalizeOutcome(val) === 'allowed person for meeting' ? (activityTwoValues.meetingMode || '') : '',
      })
      return
    }
    if (key === 'nextFollowUpDate') {
      patchCurrentActivity({ nextFollowUpDate: val, followUpDate: val })
      return
    }
    if (key === 'remark') {
      patchCurrentActivity({ remark: val, remarks: val, note: val })
      return
    }
    updateField(key, val)
  }

  /* ── Activity 03 handlers ── */
  const handleActivityThreeChange = (key, val) => {
    if (key === 'status') {
      patchCurrentActivity({
        status: val,
        remark: '',
        remarks: '',
        note: '',
        remarkWon: '',
        remarkLost: '',
        nextFollowUpDate: '',
        followUpDate: '',
        nextFollowUpTime: '',
      })
      return
    }
    if (key === 'nextFollowUpDate') {
      patchCurrentActivity({ nextFollowUpDate: val, followUpDate: val })
      return
    }
    if (key === 'remark' || key === 'remarkWon' || key === 'remarkLost') {
      patchCurrentActivity({ [key]: val, remark: val, remarks: val, note: val })
      return
    }
    updateField(key, val)
  }

  /* ── Primary action routing ── */
  const handleActivityOnePrimaryAction = async () => {
    const ok = await handleSave()
    if (!ok) return
    if (isConnected && isInterested) {
      setActiveTab(1) // advance to Activity 02
      return
    }
    if (isConnected && isNotInterested) {
      onClose() // CLOSE lead
      return
    }
    // Not Connected → stay
  }

  const handleActivityTwoPrimaryAction = async () => {
    const ok = await handleSave()
    if (!ok) return
    if (isActivityTwoAllowedPerson) {
      setActiveTab(2) // advance to Activity 03
      return
    }
    if (isActivityTwoLost) {
      onClose()
      return
    }
    // Follow Up → stay
  }

  const handleActivityThreePrimaryAction = async () => {
    const ok = await handleSave()
    if (!ok) return
    if (isActivityThreeWon || isActivityThreeLost) {
      onClose()
      return
    }
    if (isActivityThreeNegotiation) {
      setActiveTab(1) // back to Follow Up page
    }
  }

  const handleCurrentPrimaryAction = async () => {
    if (activeTab === 0) {
      await handleActivityOnePrimaryAction()
      return
    }
    if (activeTab === 1) {
      await handleActivityTwoPrimaryAction()
      return
    }
    if (activeTab === 2) {
      await handleActivityThreePrimaryAction()
      return
    }
  }

  /* ── Primary button labels ── */
  const activityOnePrimaryLabel = isConnected && isInterested
    ? 'Next Activity →'
    : isConnected && isNotInterested
      ? 'Close Lead'
      : needsActivityOneFollowUp
        ? 'Save Follow-Up'
        : 'Save & Continue'

  const activityTwoPrimaryLabel = isActivityTwoAllowedPerson
    ? 'Next Activity →'
    : isActivityTwoLost
      ? 'Close Lead'
      : isActivityTwoFollowUp
        ? 'Save Follow Up'
        : 'Save & Continue'

  const activityThreePrimaryLabel = isActivityThreeWon
    ? 'Complete Lead'
    : isActivityThreeLost
      ? 'Close Lead'
      : isActivityThreeNegotiation
        ? 'Save & Follow Up ←'
        : 'Save & Continue'

  const currentPrimaryLabel = activeTab === 0
    ? activityOnePrimaryLabel
    : activeTab === 1
      ? activityTwoPrimaryLabel
      : activityThreePrimaryLabel

  return (
    <ScreenModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Lead activities">
      <motion.div
        initial={{ opacity:0, scale:0.95, y:20 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:20 }}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lead Activities</h2>
            <p className="text-xs text-slate-500 mt-0.5">{lead?.name} · {lead?.company}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-0 overflow-x-auto custom-scrollbar pb-1">
            {ACTIVITIES.map((a, i) => {
              const AIcon = a.icon
              const done = isComplete(i)
              const active = i === activeTab
              return (
                <div key={a.id} className="flex items-center min-w-[140px] sm:min-w-0 flex-1">
                  <button
                    onClick={() => setActiveTab(i)}
                    className={`flex flex-col items-center gap-1 flex-1 px-2 py-2 rounded-xl transition-all ${active ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${done ? 'bg-emerald-500' : active ? a.color.step : 'bg-slate-300 dark:bg-slate-600'}`}>
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <AIcon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{a.label}</span>
                    <span className={`text-xs hidden sm:block text-center leading-tight ${active ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'}`}>{a.title}</span>
                  </button>
                  {i < ACTIVITIES.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity:0, x:20 }}
              animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-20 }}
              transition={{ duration:0.18 }}
            >
              {/* Activity Excel-style Header */}
              <div className="mx-4 sm:mx-6 mt-5 rounded-xl overflow-hidden border" style={{ borderColor: act.color.border }}>
                <div className="px-4 py-2 text-white text-sm font-bold flex items-center justify-between" style={{ background: act.color.header }}>
                  <span>{act.label} — {act.title}</span>
                  {act.hours && <span className="text-xs font-normal opacity-80">{act.hours} Hour{act.hours>1?'s':''}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x text-xs" style={{ background: act.color.bg, borderColor: act.color.border }}>
                  <div className="px-3 py-1.5">
                    <span className="text-slate-500">What has to be done</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{act.title}</p>
                  </div>
                  <div className="px-3 py-1.5">
                    <span className="text-slate-500">Who will do it</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{currentActivityData.assignedTo || <span className="text-slate-400 font-normal">Not assigned</span>}</p>
                  </div>
                  <div className="px-3 py-1.5">
                    <span className="text-slate-500">How will it be done</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{act.description}</p>
                  </div>
                </div>
              </div>

              {/* ═══════════════ Activity 01 — Welcome Call ═══════════════ */}
              {activeTab === 0 && (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Source', value: leadSource },
                      { label: 'Service Requirement', value: serviceRequirement },
                      { label: 'Planned Date', value: formatDateTime(plannedDate) },
                      { label: 'Actual Date', value: formatDateTime(actualDate) },
                      { label: 'Delay', value: delayMeta.label },
                      { label: 'Actual Date Status', value: delayMeta.status },
                      { label: 'Team Member', value: assignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Connection Status */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={activityOneConnectionStatus}
                        onChange={e => handleActivityOneChange('connectionStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Connected">Connected</option>
                        <option value="Not Connected">Not Connected</option>
                        <option value="CallBack">CallBack</option>
                      </select>
                    </div>

                    {/* Interest Status — shown only when Connected */}
                    {isConnected && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Interest Status <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={activityOneInterestStatus}
                          onChange={e => handleActivityOneChange('interestStatus', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        >
                          <option value="">— Select interest —</option>
                          <option value="Interested">Interested</option>
                          <option value="Not Interested">Not Interested</option>
                        </select>
                      </div>
                    )}

                    {/* Follow-Up Date & Time — shown for Not Connected and CallBack */}
                    {needsActivityOneFollowUp && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Next Follow-Up Date <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            value={activityOneValues.nextFollowUpDate || activityOneValues.followUpDate || ''}
                            onChange={e => handleActivityOneChange('nextFollowUpDate', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Next Follow-Up Time
                          </label>
                          <input
                            type="time"
                            value={activityOneValues.nextFollowUpTime || ''}
                            onChange={e => handleActivityOneChange('nextFollowUpTime', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isConnected && isInterested
                          ? 'Remarks for Interested Lead'
                          : isConnected && isNotInterested
                            ? 'Reason for Not Interested'
                            : isCallBack
                              ? 'Remarks for CallBack'
                              : isNotConnected
                                ? 'Remarks for Not Connected Lead'
                                : 'Remarks'}
                      </label>
                      <textarea
                        rows={3}
                        value={remarksValue}
                        onChange={e => handleActivityOneChange('remark', e.target.value)}
                        placeholder={
                          isConnected && isInterested
                            ? 'Add next steps or the conversation summary'
                            : isConnected && isNotInterested
                              ? 'Add the reason for not being interested'
                              : isCallBack
                                ? 'Add callback context'
                                : isNotConnected
                                  ? 'Add the reason and next follow-up context'
                                  : 'Add remarks'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    isConnected && isInterested
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : isConnected && isNotInterested
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300'
                        : needsActivityOneFollowUp
                          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
                  }`}>
                    {isConnected && isInterested && 'Interested lead — will advance to Follow Up for Meeting.'}
                    {isConnected && isNotInterested && 'Not Interested — saving will close this lead as Lost.'}
                    {isNotConnected && 'Not Connected — schedule the next follow-up date.'}
                    {isCallBack && 'CallBack — schedule the next follow-up date and time.'}
                    {!isConnected && !needsActivityOneFollowUp && 'Select a connection status to continue.'}
                  </div>

                  <ActivityHistory logs={lead?.activityLogs} activityIndex={0} />
                </div>
              )}

              {/* ═══════════════ Activity 02 — Follow Up for Meeting ═══════════════ */}
              {activeTab === 1 && (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Planned Date', value: formatDateTime(activityTwoPlannedDate) },
                      { label: 'Actual Date', value: formatDateTime(activityTwoActualDate) },
                      { label: 'Delay', value: activityTwoDelayMeta.label },
                      { label: 'Actual Date Status', value: activityTwoDelayMeta.status },
                      { label: 'Assigned To', value: activityTwoAssignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={activityTwoStatus}
                        onChange={e => handleActivityTwoChange('status', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Allowed Person for Meeting">Allowed Person for Meeting</option>
                        <option value="Follow Up">Follow Up</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>

                    {isActivityTwoFollowUp && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Next Follow-Up Date <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            value={activityTwoValues.nextFollowUpDate || activityTwoValues.followUpDate || ''}
                            onChange={e => handleActivityTwoChange('nextFollowUpDate', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Next Follow-Up Time
                          </label>
                          <input
                            type="time"
                            value={activityTwoValues.nextFollowUpTime || ''}
                            onChange={e => handleActivityTwoChange('nextFollowUpTime', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Allowed Person for Meeting — person detail fields */}
                  {isActivityTwoAllowedPerson && (
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-4 py-4 space-y-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Meeting Person Details</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Person Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={activityTwoPersonName}
                            onChange={e => handleActivityTwoChange('personName', e.target.value)}
                            placeholder="Enter person name"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Designation <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={activityTwoPersonDesignation}
                            onChange={e => handleActivityTwoChange('personDesignation', e.target.value)}
                            placeholder="Enter designation"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Meeting Date <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            value={activityTwoMeetingDate}
                            onChange={e => handleActivityTwoChange('meetingDate', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Meeting Mode <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={activityTwoMeetingMode}
                            onChange={e => handleActivityTwoChange('meetingMode', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          >
                            <option value="">— Select meeting mode —</option>
                            <option value="In-Person">In-Person</option>
                            <option value="Video Call">Video Call</option>
                            <option value="Phone Call">Phone Call</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isActivityTwoAllowedPerson
                            ? 'Meeting Person Remarks'
                            : isActivityTwoLost
                              ? 'Lost Remarks'
                              : 'Follow Up Remarks'}
                      </label>
                      <textarea
                        rows={3}
                        value={activityTwoRemark}
                        onChange={e => handleActivityTwoChange('remark', e.target.value)}
                        placeholder={
                          isActivityTwoAllowedPerson
                              ? 'Add notes about the meeting person or agenda'
                              : isActivityTwoLost
                                ? 'Add the reason the lead was lost'
                                : 'Add next-step notes for the follow-up'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    isActivityTwoAllowedPerson
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : isActivityTwoLost
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300'
                      : isActivityTwoFollowUp
                        ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
                  }`}>
                    {isActivityTwoAllowedPerson && 'Allowed Person for Meeting — capture meeting person details, then advance to Meeting Outcome.'}
                    {isActivityTwoFollowUp && 'Follow Up selected — stays here until the next follow-up is completed.'}
                    {isActivityTwoLost && 'Lost selected — save and close this lead from the follow-up flow.'}
                    {!isActivityTwoFollowUp && !isActivityTwoAllowedPerson && !isActivityTwoLost && 'Select a status to continue.'}
                  </div>

                  <ActivityHistory logs={lead?.activityLogs} activityIndex={1} />
                </div>
              )}

              {/* ═══════════════ Activity 03 — Meeting Outcome ═══════════════ */}
              {activeTab === 2 && (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Planned Date', value: formatDateTime(activityThreePlannedDate) },
                      { label: 'Actual Date', value: formatDateTime(activityThreeActualDate) },
                      { label: 'Delay', value: activityThreeDelayMeta.label },
                      { label: 'Actual Date Status', value: activityThreeDelayMeta.status },
                      { label: 'Assigned To', value: activityThreeAssignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={activityThreeStatus}
                        onChange={e => handleActivityThreeChange('status', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                        <option value="Negotiation">Negotiation</option>
                      </select>
                    </div>

                    {/* Negotiation follow-up fields */}
                    {isActivityThreeNegotiation && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Next Follow-Up Date <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            value={activityThreeValues.nextFollowUpDate || activityThreeValues.followUpDate || ''}
                            onChange={e => handleActivityThreeChange('nextFollowUpDate', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Next Follow-Up Time
                          </label>
                          <input
                            type="time"
                            value={activityThreeValues.nextFollowUpTime || ''}
                            onChange={e => handleActivityThreeChange('nextFollowUpTime', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                      </>
                    )}

                    {/* Won fields */}
                    {isActivityThreeWon && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Meeting Price Final (₹) <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            value={activityThreeMeetingPriceFinal}
                            onChange={e => handleActivityThreeChange('meetingPriceFinal', e.target.value)}
                            placeholder="Enter final meeting price"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Payment Received <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={activityThreePaymentReceived}
                            onChange={e => handleActivityThreeChange('paymentReceived', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          >
                            <option value="">— Select —</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Lost fields */}
                    {isActivityThreeLost && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Lost Category <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={activityThreeLostCategory}
                          onChange={e => handleActivityThreeChange('lostCategory', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        >
                          <option value="">— Select lost category —</option>
                          <option value="Price">Price</option>
                          <option value="Competition">Competition</option>
                          <option value="No Need">No Need</option>
                          <option value="Timing">Timing</option>
                          <option value="Budget">Budget</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isActivityThreeWon
                          ? 'Won Remarks'
                          : isActivityThreeLost
                            ? 'Lost Remarks'
                            : 'Negotiation Remarks'}
                      </label>
                      <textarea
                        rows={3}
                        value={
                          isActivityThreeWon
                            ? activityThreeRemarkWon
                            : isActivityThreeLost
                              ? activityThreeRemarkLost
                              : activityThreeRemark
                        }
                        onChange={e => handleActivityThreeChange(
                          isActivityThreeWon
                            ? 'remarkWon'
                            : isActivityThreeLost
                              ? 'remarkLost'
                              : 'remark',
                          e.target.value
                        )}
                        placeholder={
                          isActivityThreeWon
                            ? 'Add win summary, payment notes, or next step'
                            : isActivityThreeLost
                              ? 'Add the reason the lead was lost'
                              : 'Add negotiation notes and next step'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    isActivityThreeWon
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : isActivityThreeLost
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300'
                        : isActivityThreeNegotiation
                          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
                  }`}>
                    {isActivityThreeWon && 'Won — capture final price and payment, then complete the lead.'}
                    {isActivityThreeLost && 'Lost — select a lost category and add remarks, then close the lead.'}
                    {isActivityThreeNegotiation && 'Negotiation — schedule a follow-up and return to Follow Up page.'}
                    {!isActivityThreeWon && !isActivityThreeLost && !isActivityThreeNegotiation && 'Select a status to continue.'}
                  </div>

                  <ActivityHistory logs={lead?.activityLogs} activityIndex={2} />
                </div>
              )}

              {/* Saved banner */}
              {saved[activeTab] && (
                <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Activity saved successfully!
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {activeTab > 0 && (
              <button onClick={() => setActiveTab(t => t - 1)} className="btn-secondary text-xs">← Prev</button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCurrentPrimaryAction}
              disabled={saving
                || (activeTab === 0 && !activityOneConnectionStatus)
                || (activeTab === 1 && !activityTwoStatus)
                || (activeTab === 2 && !activityThreeStatus)
              }
              className={`btn-primary text-xs gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                activeTab === 2
                  ? isActivityThreeWon
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : isActivityThreeLost
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-accent-400 hover:bg-accent-500'
                  : activeTab === 0 && isConnected && isNotInterested
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-accent-400 hover:bg-accent-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {currentPrimaryLabel}
            </button>
          </div>
        </div>
      </motion.div>
      </div>
    </ScreenModalPortal>
  )
}
