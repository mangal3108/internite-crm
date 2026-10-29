import { motion } from 'framer-motion'
import { AlertTriangle, Clock3, Kanban } from 'lucide-react'

export default function DelayAlertPanel({ delayedLeads, onOpenPipeline, slaMinutes = 60 }) {
  const totalAlerts = delayedLeads.length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.12 }}
      className="fixed right-2 top-[4.25rem] z-[9999] w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl dark:border-slate-800/50 dark:bg-slate-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Lead Attention Alerts</span>
          {totalAlerts > 0 && (
            <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {totalAlerts}
            </span>
          )}
        </div>
        <button
          onClick={onOpenPipeline}
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
        >
          Open Pipeline
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-100/60 dark:divide-slate-700/30">
        {totalAlerts === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            <Clock3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No leads have crossed the {slaMinutes}-minute response window.</p>
          </div>
        )}

        {delayedLeads.map((lead) => (
          <div key={lead.id} className="flex items-start gap-3 px-4 py-3 bg-red-50/40 dark:bg-red-950/15">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 flex-shrink-0">
              <Kanban className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">
                {lead.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                {lead.company || 'No company'} · Owner {lead.assignedTo || 'Unassigned'}
              </p>
              <p className="text-[10px] text-red-500 mt-1">
                Response time ran out ({slaMinutes} min). Take immediate follow up.
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
