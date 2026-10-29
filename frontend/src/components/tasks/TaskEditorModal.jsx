import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import PaginatedSelect from '../ui/PaginatedSelect'
import ScreenModalPortal from '../ui/ScreenModalPortal'

const DEFAULT_FORM = {
  title: '',
  description: '',
  type: 'Follow-up',
  status: 'PENDING',
  priority: 'MEDIUM',
  dueDate: '',
  leadId: '',
  dealId: '',
  assignedToId: '',
}

const toDateTimeInputValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TaskEditorModal({
  open,
  mode = 'create',
  task = null,
  leads = [],
  employees = [],
  defaultLeadId = '',
  defaultAssigneeId = '',
  onClose,
  onSave,
}) {
  const baseForm = useMemo(() => ({
    ...DEFAULT_FORM,
    leadId: defaultLeadId || '',
    assignedToId: defaultAssigneeId || '',
  }), [defaultAssigneeId, defaultLeadId])

  const [form, setForm] = useState(baseForm)

  const assigneeOptions = useMemo(() => [
    { value: '', label: 'Unassigned' },
    ...employees.map((employee) => ({
      value: employee.id,
      label: employee.name,
      meta: employee.role || '',
    })),
  ], [employees])

  const leadOptions = useMemo(() => [
    { value: '', label: 'No lead' },
    ...leads.map((lead) => ({
      value: lead.id,
      label: lead.name || 'Untitled lead',
      meta: lead.company || lead.email || '',
    })),
  ], [leads])

  useEffect(() => {
    if (!open) return
    setForm({
      ...baseForm,
      ...(task || {}),
      dueDate: toDateTimeInputValue(task?.dueDate),
      leadId: task?.leadId || defaultLeadId || '',
      dealId: task?.dealId || '',
      assignedToId: task?.assignedToId || defaultAssigneeId || '',
    })
  }, [baseForm, defaultAssigneeId, defaultLeadId, open, task])

  if (!open) return null

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSave?.({
      ...form,
      title: form.title.trim(),
      dueDate: form.dueDate || null,
      leadId: form.leadId || null,
      dealId: form.dealId || null,
      assignedToId: form.assignedToId || null,
    })
  }

  return (
    <ScreenModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative glass-card z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 custom-scrollbar"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
              {mode === 'edit' ? 'Update Task' : 'New Task'}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {mode === 'edit' ? 'Edit task details' : 'Create a task or follow-up'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close task editor">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Title *</label>
              <input name="title" value={form.title} onChange={handleChange} required className="input" placeholder="Call lead and confirm demo" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Description</label>
              <textarea name="description" value={form.description || ''} onChange={handleChange} rows={4} className="input resize-none" placeholder="Add a crisp note about the next action" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="input">
                {['Follow-up', 'Call', 'Email', 'Meeting', 'Demo', 'Reminder', 'Internal'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange} className="input">
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input">
                {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Due Date</label>
              <input name="dueDate" type="datetime-local" value={form.dueDate || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Assignee</label>
              <PaginatedSelect
                value={form.assignedToId || ''}
                onChange={(nextValue) => setForm((current) => ({ ...current, assignedToId: nextValue }))}
                options={assigneeOptions}
                placeholder="Unassigned"
                searchPlaceholder="Search employees..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Lead</label>
              <PaginatedSelect
                value={form.leadId || ''}
                onChange={(nextValue) => setForm((current) => ({ ...current, leadId: nextValue }))}
                options={leadOptions}
                placeholder="No lead"
                searchPlaceholder="Search leads..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Deal ID</label>
              <input name="dealId" value={form.dealId || ''} onChange={handleChange} className="input" placeholder="Optional linked deal" />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              {mode === 'edit' ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </motion.div>
      </div>
    </ScreenModalPortal>
  )
}
