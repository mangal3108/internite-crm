import { create } from 'zustand'
import { Device } from '@twilio/voice-sdk'
import { callsAPI } from '../services/api'

// The Twilio Device and live Call are not serialisable, so they live outside the store state.
let device = null
let activeCall = null
let timer = null

const IN_CALL = ['connecting', 'ringing', 'in-call']

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

export const useSoftphoneStore = create((set, get) => ({
  open: false,
  minimized: false,
  status: 'idle', // idle | connecting | ringing | in-call | ended | error
  error: '',
  toNumber: '',
  fromNumber: '',
  lead: null,
  callSid: '',
  muted: false,
  seconds: 0,
  micLevel: 0,
  inputDevices: [],
  inputDeviceId: 'default',

  isBusy: () => IN_CALL.includes(get().status),

  openPanel: ({ number, lead } = {}) => {
    if (get().isBusy()) {
      set({ open: true, minimized: false })
      return
    }
    set({
      open: true,
      minimized: false,
      status: 'idle',
      error: '',
      toNumber: number || lead?.phone || get().toNumber,
      lead: lead || null,
    })
  },

  // Opens the Browser Phone and dials right away: audio stays on this computer, no agent line is rung.
  startCall: async ({ number, fromNumber, lead } = {}) => {
    if (get().isBusy()) {
      set({ open: true, minimized: false })
      return
    }
    get().openPanel({ number, lead })
    if (fromNumber) set({ fromNumber })
    await get().call()
  },

  closePanel: () => {
    if (get().isBusy()) return
    set({ open: false, status: 'idle', error: '', lead: null })
  },

  setMinimized: (minimized) => set({ minimized }),
  setToNumber: (toNumber) => set({ toNumber }),
  setFromNumber: (fromNumber) => set({ fromNumber }),

  ensureDevice: async () => {
    if (device) return device
    const { token } = await callsAPI.voiceToken()
    device = new Device(token, {
      codecPreferences: ['opus', 'pcmu'],
      closeProtection: 'A call is in progress. Leaving will hang up.',
    })
    device.on('tokenWillExpire', async () => {
      try {
        const fresh = await callsAPI.voiceToken()
        device.updateToken(fresh.token)
      } catch {
        // the next call will fetch a new token
      }
    })
    device.on('error', (err) => set({ error: err?.message || 'Twilio device error' }))
    device.audio?.on?.('deviceChange', () => get().refreshInputDevices())
    return device
  },

  refreshInputDevices: () => {
    const map = device?.audio?.availableInputDevices
    if (!map) return
    const list = []
    map.forEach((d, id) => list.push({ id, label: d.label || 'Microphone' }))
    set({ inputDevices: list })
  },

  setInputDevice: async (id) => {
    set({ inputDeviceId: id })
    try {
      await device?.audio?.setInputDevice(id)
    } catch (err) {
      set({ error: err?.message || 'Could not switch microphone' })
    }
  },

  call: async () => {
    const { toNumber, fromNumber, lead } = get()
    if (!toNumber.trim()) {
      set({ error: 'Enter a number to call.' })
      return
    }
    if (!fromNumber.trim()) {
      set({ error: 'Choose a Twilio caller ID (From).' })
      return
    }
    set({ status: 'connecting', error: '', seconds: 0, muted: false, callSid: '', micLevel: 0 })
    try {
      const dev = await get().ensureDevice()
      const call = await dev.connect({ params: { To: toNumber.trim(), CallerId: fromNumber.trim() } })
      activeCall = call
      get().refreshInputDevices()

      const log = (status, extra = {}) => {
        const callSid = call.parameters?.CallSid || get().callSid
        if (!callSid) return
        callsAPI.logBrowserCall({
          callSid,
          status,
          toNumber: toNumber.trim(),
          fromNumber: fromNumber.trim(),
          leadId: lead?.id || '',
          leadName: lead?.name || '',
          ...extra,
        }).catch(() => {})
      }

      call.on('ringing', () => set({ status: 'ringing' }))
      call.on('accept', () => {
        set({ status: 'in-call', callSid: call.parameters?.CallSid || '' })
        stopTimer()
        timer = setInterval(() => set((s) => ({ seconds: s.seconds + 1 })), 1000)
        log('IN_PROGRESS')
      })
      call.on('volume', (input) => set({ micLevel: Math.min(1, input * 4) }))
      call.on('mute', (muted) => set({ muted }))
      call.on('disconnect', () => {
        stopTimer()
        log('COMPLETED', { durationSeconds: String(get().seconds) })
        activeCall = null
        set({ status: 'ended', micLevel: 0 })
      })
      call.on('cancel', () => {
        stopTimer()
        activeCall = null
        set({ status: 'ended', micLevel: 0 })
      })
      call.on('reject', () => {
        stopTimer()
        activeCall = null
        set({ status: 'ended', micLevel: 0 })
      })
      call.on('error', (err) => {
        stopTimer()
        set({ status: 'error', error: err?.message || 'Call failed' })
      })
    } catch (err) {
      stopTimer()
      activeCall = null
      set({ status: 'error', error: err?.message || 'Could not start the call' })
    }
  },

  hangup: () => {
    if (activeCall) activeCall.disconnect()
    else device?.disconnectAll()
  },

  toggleMute: () => {
    if (!activeCall) return
    activeCall.mute(!activeCall.isMuted())
  },

  sendDigit: (digit) => {
    activeCall?.sendDigits(digit)
  },
}))
