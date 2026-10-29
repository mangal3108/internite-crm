import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Mail, Shield, Phone, Building2, Briefcase, Users, KeyRound, Bell, UserCircle, Camera, Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useLeadsStore } from '../store/leadsStore'
import { authAPI } from '../services/api'
import ScreenModalPortal from '../components/ui/ScreenModalPortal'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Company-level role permissions — PLATFORM_ADMIN is a SaaS-level role shown separately on their Platform Admin dashboard
const ROLE_PERMISSIONS = {
  PLATFORM_ADMIN: ['Platform operator', 'Manage all companies', 'Manage subscriptions', 'Security & compliance', 'View all data'],
  COMPANY_ADMIN: ['View all data', 'Manage users', 'Configure settings', 'View billing', 'All module access', 'Delete records'],
  ADMIN: ['View all data', 'Manage users', 'Configure settings', 'View billing', 'All module access', 'Delete records'],
  MANAGER: ['View all data', 'Manage assigned team', 'View reports', 'Create campaigns', 'Export data'],
  SALES_EXEC: ['View own leads', 'Create & edit leads', 'Manage own deals', 'Log activities', 'View assigned customers'],
  NORMAL_USER: ['View own leads', 'Create & edit leads', 'Manage own deals', 'Log activities', 'View assigned customers'],
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const { leads } = useLeadsStore()
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const avatarInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    avatarUrl: '',
  })

  useEffect(() => {
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      department: user?.department ?? '',
      designation: user?.designation ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    })
  }, [user])

  useEffect(() => {
    setAvatarBroken(false)
  }, [form.avatarUrl])

  const dirty = useMemo(() => {
    return (
      form.name !== (user?.name ?? '') ||
      form.email !== (user?.email ?? '') ||
      form.phone !== (user?.phone ?? '') ||
      form.department !== (user?.department ?? '') ||
      form.designation !== (user?.designation ?? '') ||
      form.avatarUrl !== (user?.avatarUrl ?? '')
    )
  }, [form, user])

  const role = user?.role || 'SALES_EXEC'
  const status = user?.isActive === false ? 'Inactive' : 'Active'
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.SALES_EXEC
  const assignedTeam = user?.assignedTeam || (role === 'PLATFORM_ADMIN' ? 'All Companies' : ['COMPANY_ADMIN', 'ADMIN'].includes(role) ? 'All Teams' : role === 'MANAGER' ? 'Sales Team' : 'Assigned Leads Queue')

  const leadsCreated = user?.activitySummary?.leadsCreated ?? (leads?.length ?? 0)
  const dealsClosed = user?.activitySummary?.dealsClosed ?? 0
  const tasksCompleted = user?.activitySummary?.tasksCompleted ?? 0
  const pendingFollowUps = user?.activitySummary?.pendingFollowUps ?? (leads ?? []).filter((lead) => String(lead?.status ?? '').toLowerCase() === 'new').length

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const onReset = () => {
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      department: user?.department ?? '',
      designation: user?.designation ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    })
    setIsEditing(false)
  }

  const onSave = async () => {
    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()
    const department = form.department.trim()
    const designation = form.designation.trim()
    const avatarUrl = form.avatarUrl.trim()

    if (!name) {
      toast.error('Name is required.')
      return
    }
    if (email && !emailPattern.test(email)) {
      toast.error('Email format looks invalid.')
      return
    }

    setSaving(true)
    try {
      const updated = await authAPI.updateMe({ name, email, phone, avatarUrl })
      updateUser({
        ...updated,
        department,
        designation,
      })
      setIsEditing(false)
      toast.success('Profile updated successfully.')
    } catch (err) {
      toast.error(err?.message || 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const onAvatarUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid photo file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      setForm((prev) => ({ ...prev, avatarUrl: result }))
      toast.success('Photo selected.')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const openAvatarPicker = () => {
    if (!isEditing) return
    avatarInputRef.current?.click()
  }

  const openNotifications = () => navigate('/settings?tab=notifications')

  const onPasswordChange = () => {
    setShowPasswordModal(false)
    toast.info('Password changes are managed by your identity provider or admin console.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Profile Page</h1>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="btn-primary gap-2">
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <>
              <button onClick={onReset} disabled={saving} className="btn-secondary">
                Cancel
              </button>
              <button onClick={onSave} disabled={saving || !dirty} className="btn-primary gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-5 sm:p-6">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onAvatarUpload}
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-slate-200/60 dark:border-slate-700/40">
          <button
            type="button"
            onClick={openAvatarPicker}
            className={`relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white font-bold text-2xl flex items-center justify-center overflow-hidden ${isEditing ? 'cursor-pointer ring-2 ring-brand-500/40' : 'cursor-default'}`}
            title={isEditing ? 'Click to change profile photo' : 'Profile photo'}
          >
            {form.avatarUrl && !avatarBroken ? (
              <img
                src={form.avatarUrl}
                alt="Profile photo"
                className="w-full h-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span>{(form.name || user?.name || 'U').charAt(0).toUpperCase()}</span>
            )}
            {isEditing && (
              <span className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </span>
            )}
          </button>

          <div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{form.name || 'Your Name'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{form.email || '—'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Role: {role.replace('_', ' ')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Status: {status}</p>
            {isEditing && (
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">Click profile photo to change avatar</p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Full Name</label>
              <div className="relative">
                <UserCircle className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  placeholder="Enter full name"
                  className="input pl-9"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.email}
                  onChange={(e) => onChange('email', e.target.value)}
                  placeholder="you@company.com"
                  className="input pl-9"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.phone}
                  onChange={(e) => onChange('phone', e.target.value)}
                  placeholder="+91-98765-43210"
                  className="input pl-9"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Department</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.department}
                  onChange={(e) => onChange('department', e.target.value)}
                  placeholder="Sales"
                  className="input pl-9"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Designation</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.designation}
                  onChange={(e) => onChange('designation', e.target.value)}
                  placeholder="Admin"
                  className="input pl-9"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">CRM Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Role
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{role.replace('_', ' ')}</p>
            </div>
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 p-3 sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Permissions</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{permissions.join(' · ')}</p>
            </div>
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 p-3 sm:col-span-3">
              <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Assigned Team
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{assignedTeam}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Activity Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Leads Created', value: leadsCreated },
              { label: 'Deals Closed', value: dealsClosed },
              { label: 'Tasks Completed', value: tasksCompleted },
              { label: 'Pending Follow-ups', value: pendingFollowUps },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Account Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => setShowPasswordModal(true)} className="btn-secondary justify-start gap-2">
              <KeyRound className="w-4 h-4" />
              Password Management
            </button>

            <button onClick={openNotifications} className="btn-secondary justify-start gap-2">
              <Bell className="w-4 h-4" />
              Notification Settings
            </button>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <ScreenModalPortal>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Change Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 p-4 text-sm text-slate-600 dark:text-slate-400">
                Passwords are managed by your admin or identity provider.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={onPasswordChange}
                className="btn-primary flex-1"
              >
                Got it
              </button>
            </div>
          </div>
          </div>
        </ScreenModalPortal>
      )}
    </div>
  )
}
