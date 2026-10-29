import { useState } from 'react'
import DailyLeadDashboard from '../components/DailyLeadDashboard'
import TaskFollowUpPage from './TaskFollowUpPage'

export default function TaskPage() {
  const [view, setView] = useState('analytics')
  return <div className="space-y-5">
    <nav aria-label="Task views" className="flex gap-2">
      <button className={view === 'analytics' ? 'btn-primary' : 'btn-secondary'} aria-pressed={view === 'analytics'} onClick={() => setView('analytics')}>Daily analytics</button>
      <button className={view === 'tasks' ? 'btn-primary' : 'btn-secondary'} aria-pressed={view === 'tasks'} onClick={() => setView('tasks')}>Manage follow-ups</button>
    </nav>
    {view === 'analytics' ? <DailyLeadDashboard /> : <TaskFollowUpPage />}
  </div>
}
