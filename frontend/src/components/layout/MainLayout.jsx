import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Users, Clock, CheckCircle2, Plus, UserPlus, MessageSquare, Kanban } from 'lucide-react'
import SarathiMark from '../ui/SarathiMark'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Breadcrumb from './Breadcrumb'
import SpeedDial from '../ui/SpeedDial'

function StatusBar() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = window.setInterval(() => setTime(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="edu-status-bar text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-brand-500" />
          <span className="font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-accent-500" />
          <span>Team Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="font-medium">System Status: All Good</span>
      </div>
    </div>
  )
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef(null)

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    const frame = window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.search])

  const speedDialActions = [
    { label: 'New Lead', icon: <UserPlus className="w-5 h-5 text-slate-950" />, onClick: () => navigate('/leads'), color: 'bg-accent-400' },
    { label: 'Send Message', icon: <MessageSquare className="w-5 h-5 text-slate-950" />, onClick: () => navigate('/communication'), color: 'bg-brand-300' },
    { label: 'Ask Sarathi', icon: <SarathiMark className="w-5 h-5 text-slate-950" />, onClick: () => navigate('/ai-engine'), color: 'bg-accent-400' },
    { label: 'Pipeline', icon: <Kanban className="w-5 h-5 text-slate-950" />, onClick: () => navigate('/pipeline'), color: 'bg-brand-300' },
  ]

  return (
    <div className="nexa-compact relative flex h-screen overflow-hidden bg-[var(--it-canvas)]">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onRefresh={() => setRefreshKey((prev) => prev + 1)}
        />
        <main ref={mainRef} className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-3 pt-1 sm:px-4 lg:px-5">
          <div className="nexa-page-transition mx-auto w-full max-w-[1680px]" key={`${location.pathname}-${refreshKey}`}>
            <Breadcrumb />
            <Outlet />
          </div>
        </main>
        <StatusBar />
      </div>

      {/* Floating Action Button — Quick Actions */}
      <SpeedDial actions={speedDialActions} />
    </div>
  )
}
