import { formatPhoneWithCountry } from '../ui/PhoneInputWithCountry'

// Explains the caller-ID list (empty account, trial limits) instead of leaving it silently blank.
export default function TwilioNumbersHint({ callOptions }) {
  if (!callOptions) return null

  if (callOptions.twilioNumbersError) {
    return (
      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5">
        {callOptions.twilioNumbersError}
      </p>
    )
  }

  if (callOptions.twilioConfigured && !(callOptions.phoneNumbers?.length > 0)) {
    return (
      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
        Your Twilio account has no phone number or verified caller ID yet. In the Twilio Console, get the free
        trial number (Home → “Get a phone number”) or add your mobile under Verified Caller IDs, then reopen this window.
      </p>
    )
  }

  const hasOwnNumber = Object.values(callOptions.numberLabels || {}).includes('Twilio number')
  if (callOptions.twilioTrial) {
    return (
      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
        Twilio trial: calls only connect to verified numbers.
        {!hasOwnNumber && ' No Twilio number yet, so a verified caller ID is used as the From number.'}
      </p>
    )
  }

  return null
}

export function numberLabel(callOptions, num, idx) {
  const label = callOptions?.numberLabels?.[num]
  if (label) return `(${label})`
  return idx === 0 ? '(Default Twilio Line)' : `(Line ${idx + 1})`
}

// Caller ID option text: number with its country, then its role, e.g. "+1 516 529 0758 · United States (Twilio number)".
export function callerIdLabel(callOptions, num, idx) {
  return `${formatPhoneWithCountry(num)} ${numberLabel(callOptions, num, idx)}`
}

// Hands the number (and lead) to the on-screen Browser Phone, which talks through this computer.
export function OpenSoftphoneButton({ number, lead, onOpened }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('open-softphone', { detail: { number, lead } }))
        onOpened?.()
      }}
      className="w-full p-3 rounded-2xl border border-brand-300 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/30 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-left flex items-center gap-3 transition-colors"
    >
      <span className="p-2 rounded-xl bg-accent-400 text-slate-950 text-xs font-bold">🎧</span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-brand-800 dark:text-brand-300">Talk from this computer</span>
        <span className="block text-[11px] text-brand-700/80 dark:text-brand-400">
          Mute, keypad and timer on screen.
        </span>
      </span>
    </button>
  )
}

// One-click "To" choices from the account's verified caller IDs (the only callable numbers on a trial).
export function VerifiedNumbersPicker({ callOptions, onPick }) {
  const verified = callOptions?.verifiedNumbers || []
  if (verified.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {callOptions.twilioTrial ? 'Verified in Twilio (trial can call only these):' : 'Verified in Twilio:'}
      </span>
      {verified.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onPick(num)}
          className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-brand-300 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100"
        >
          {formatPhoneWithCountry(num)}
        </button>
      ))}
    </div>
  )
}
