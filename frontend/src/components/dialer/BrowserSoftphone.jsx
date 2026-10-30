import { useEffect, useState } from 'react'
import {
  Phone, PhoneCall, PhoneOff, Mic, MicOff, Grid3x3, Minus, X, Headphones, AlertCircle, User,
} from 'lucide-react'
import { callsAPI } from '../../services/api'
import { useSoftphoneStore } from '../../store/softphoneStore'
import PhoneInputWithCountry, { formatPhoneWithCountry, phoneCountry } from '../ui/PhoneInputWithCountry'
import TwilioNumbersHint, { callerIdLabel, VerifiedNumbersPicker } from './TwilioNumbersHint'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

const STATUS_TEXT = {
  idle: 'Ready',
  connecting: 'Connecting…',
  ringing: 'Ringing…',
  'in-call': 'Connected',
  ended: 'Call ended',
  error: 'Call failed',
}

function formatTime(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * On-screen phone using the Twilio Voice SDK: audio goes through this computer's mic and speakers.
 * Opened from anywhere with: window.dispatchEvent(new CustomEvent('open-softphone', { detail: { number, lead } }))
 */
export default function BrowserSoftphone() {
  const s = useSoftphoneStore()
  const [callOptions, setCallOptions] = useState(null)
  const [showKeypad, setShowKeypad] = useState(false)
  const inCall = ['connecting', 'ringing', 'in-call'].includes(s.status)

  useEffect(() => {
    const onOpen = (e) => useSoftphoneStore.getState().openPanel(e.detail || {})
    window.addEventListener('open-softphone', onOpen)
    return () => window.removeEventListener('open-softphone', onOpen)
  }, [])

  useEffect(() => {
    if (!s.open || callOptions) return
    callsAPI.getOptions()
      .then((data) => {
        setCallOptions(data)
        const numbers = data?.phoneNumbers || []
        const current = useSoftphoneStore.getState().fromNumber
        if (!current || (numbers.length > 0 && !numbers.includes(current))) {
          useSoftphoneStore.getState().setFromNumber(data?.defaultPhoneNumber || numbers[0] || '')
        }
      })
      .catch(() => {})
  }, [s.open, callOptions])

  if (!s.open) return null

  if (s.minimized) {
    return (
      <button
        type="button"
        onClick={() => s.setMinimized(false)}
        className={`fixed bottom-5 right-5 z-[900] flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl text-white text-sm font-semibold ${
          inCall ? 'bg-brand-600 animate-pulse' : 'bg-slate-800'
        }`}
      >
        <PhoneCall className="w-4 h-4" />
        {inCall ? `${STATUS_TEXT[s.status]} ${s.status === 'in-call' ? formatTime(s.seconds) : ''}` : 'Browser Phone'}
      </button>
    )
  }

  const numbers = callOptions?.phoneNumbers || []

  return (
    <div className="fixed bottom-5 right-5 z-[900] w-[340px] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Browser Phone</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            s.status === 'error' ? 'bg-rose-100 text-rose-700' : inCall ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {STATUS_TEXT[s.status]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => s.setMinimized(true)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" title="Minimize">
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={s.closePanel}
            disabled={inCall}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30"
            title={inCall ? 'Hang up first' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {inCall ? (
        <div className="p-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white space-y-4">
          <div className="text-center space-y-1">
            <p className="text-lg font-bold font-mono">{s.toNumber}</p>
            {phoneCountry(s.toNumber) && <p className="text-xs text-slate-400">{phoneCountry(s.toNumber).country}</p>}
            {s.lead?.name && (
              <p className="text-xs text-slate-400 flex items-center justify-center gap-1"><User className="w-3 h-3" />{s.lead.name}</p>
            )}
            <p className="text-3xl font-mono font-bold pt-1">{s.status === 'in-call' ? formatTime(s.seconds) : '··:··'}</p>
            <p className="text-[11px] text-slate-400">From {formatPhoneWithCountry(s.fromNumber)}</p>
          </div>

          {/* Mic level */}
          <div className="flex items-center gap-2">
            {s.muted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-brand-400" />}
            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all duration-100" style={{ width: `${s.muted ? 0 : Math.round(s.micLevel * 100)}%` }} />
            </div>
          </div>

          {showKeypad && (
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button key={k} type="button" onClick={() => s.sendDigit(k)} className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold">
                  {k}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={s.toggleMute}
              disabled={s.status !== 'in-call'}
              className={`p-3.5 rounded-full border disabled:opacity-40 ${s.muted ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
              title={s.muted ? 'Unmute' : 'Mute'}
            >
              {s.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowKeypad((v) => !v)}
              disabled={s.status !== 'in-call'}
              className={`p-3.5 rounded-full border disabled:opacity-40 ${showKeypad ? 'bg-brand-500/20 border-brand-500 text-brand-300' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
              title="Keypad"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button type="button" onClick={s.hangup} className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-700" title="Hang up">
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>

          {s.inputDevices.length > 1 && (
            <select
              value={s.inputDeviceId}
              onChange={(e) => s.setInputDevice(e.target.value)}
              className="w-full text-xs rounded-xl bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-200"
            >
              {s.inputDevices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Call</label>
            <PhoneInputWithCountry value={s.toNumber} onChange={s.setToNumber} placeholder="Number to call" />
            <VerifiedNumbersPicker callOptions={callOptions} onPick={s.setToNumber} />
            {s.lead?.name && <p className="text-[11px] text-slate-500 mt-1">Lead: {s.lead.name}</p>}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">From (Twilio caller ID)</label>
            <select
              value={s.fromNumber}
              onChange={(e) => s.setFromNumber(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
            >
              {numbers.length === 0 && <option value="">No caller ID available</option>}
              {numbers.map((num, idx) => (
                <option key={num} value={num}>{callerIdLabel(callOptions, num, idx)}</option>
              ))}
            </select>
            <TwilioNumbersHint callOptions={callOptions} />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => s.setToNumber(`${s.toNumber}${k}`)}
                className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700"
              >
                {k}
              </button>
            ))}
          </div>

          {s.error && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{s.error}</span>
            </p>
          )}

          <button
            type="button"
            onClick={s.call}
            disabled={!s.toNumber.trim() || !s.fromNumber}
            className="w-full py-3 rounded-2xl bg-accent-400 hover:bg-accent-500 disabled:opacity-40 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-none"
          >
            <Phone className="w-4 h-4" />
            Call from this computer
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Uses your mic and speakers. Allow mic access when asked.
          </p>
        </div>
      )}
    </div>
  )
}
