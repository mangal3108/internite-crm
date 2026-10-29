import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, Plus, Trophy, Edit, Trash2, Crown, UserCheck, User, X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { teamAPI, leadsAPI, dealsAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { PERMISSIONS as APP_PERMISSIONS, hasPermission } from '../../utils/permissions'
import { buildTeamLeaderboard } from '../../utils/liveMetrics'
import { fetchAllPages } from '../../utils/pagination'
import Chip from '../ui/Chip'
import { LinearProgress } from '../ui/Progress'
import AvatarGroup from '../ui/AvatarGroup'
import Rating from '../ui/Rating'
import ScreenModalPortal from '../ui/ScreenModalPortal'
import CopyableContact from '../ui/CopyableContact'

// Company-level roles only — PLATFORM_ADMIN is a separate SaaS-level role, not part of any company
const ROLE_CONFIG = {
  COMPANY_ADMIN: { label: 'Company Admin', icon: Crown, cls: 'badge bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
  ADMIN: { label: 'Admin', icon: Crown, cls: 'badge bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
  MANAGER: { label: 'Manager', icon: UserCheck, cls: 'badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400' },
  SALES_EXEC: { label: 'Sales Exec', icon: User, cls: 'badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
  NORMAL_USER: { label: 'Normal User', icon: User, cls: 'badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
}

const ROLE_PERFORMANCE_LABEL = {
  COMPANY_ADMIN: 'Company admin account',
  ADMIN: 'Admin account',
  MANAGER: 'Manager account',
  SALES_EXEC: 'Sales account',
  NORMAL_USER: 'Normal user account',
}

const DEFAULT_ROLE_DEFINITIONS = Object.entries(ROLE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  permissions: [],
}))

const MEMBER_FORM_INITIAL = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'SALES_EXEC',
  status: 'active',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/

const formatPermissionLabel = (permission = '') =>
  permission
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')

const groupPermissionsByModule = (permissions = []) =>
  permissions.reduce((groups, permission) => {
    const [module = 'general'] = String(permission).split('.')
    if (!groups[module]) groups[module] = []
    groups[module].push(permission)
    return groups
  }, {})

export default function TeamPage() {
  const { user } = useAuthStore()
  const [team, setTeam] = useState([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [liveLeaderboard, setLiveLeaderboard] = useState([])
  const [roleDefinitions, setRoleDefinitions] = useState(DEFAULT_ROLE_DEFINITIONS)
  const [selectedRole, setSelectedRole] = useState('SALES_EXEC')
  const [memberModal, setMemberModal] = useState(null)
  const [memberForm, setMemberForm] = useState(MEMBER_FORM_INITIAL)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const canInvite = hasPermission(user, APP_PERMISSIONS.TEAM_INVITE)
  const canUpdate = hasPermission(user, APP_PERMISSIONS.TEAM_UPDATE)
  const canDeactivate = hasPermission(user, APP_PERMISSIONS.TEAM_DEACTIVATE)
  const isManager = user?.role === 'MANAGER'
  const isAdminLike = ['COMPANY_ADMIN', 'ADMIN'].includes(user?.role)
  const roleOptions = Object.keys(ROLE_CONFIG).filter((roleKey) => !isManager || !['COMPANY_ADMIN', 'ADMIN'].includes(roleKey))
  const selectedRoleDefinition = roleDefinitions.find((role) => role.value === selectedRole) || roleDefinitions[0]
  const selectedRolePermissions = selectedRoleDefinition?.permissions || []
  const selectedPermissionGroups = groupPermissionsByModule(selectedRolePermissions)

  useEffect(() => {
    let mounted = true
    const loadTeam = async () => {
      setLoadingTeam(true)
      try {
        const [users, leadRows, dealRows, roles] = await Promise.all([
          teamAPI.getAll({ includeInactive: true }),
          fetchAllPages((params) => leadsAPI.getAll(params), 250).then((result) => result.rows).catch(() => []),
          fetchAllPages((params) => dealsAPI.getAll(params), 200).then((result) => result.rows).catch(() => []),
          teamAPI.getRoles().catch(() => DEFAULT_ROLE_DEFINITIONS),
        ])
        if (!mounted) return
        const normalized = (users ?? []).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          role: u.role || 'SALES_EXEC',
          status: u.isActive === false ? 'inactive' : 'active',
          leads: 0,
          deals: 0,
          avatar: (u.name || 'U').charAt(0).toUpperCase(),
          badge: '',
          joinedAt: '',
        }))
        setTeam(normalized)
        setLiveLeaderboard(buildTeamLeaderboard({ users, leads: leadRows, deals: dealRows }))
        const normalizedRoles = (roles || [])
          .filter((role) => ROLE_CONFIG[role.value])
          .map((role) => ({
            value: role.value,
            label: role.label || ROLE_CONFIG[role.value].label,
            permissions: Array.isArray(role.permissions) ? role.permissions : [],
        }))
        if (normalizedRoles.length > 0) {
          setRoleDefinitions(normalizedRoles)
        }
      } catch (err) {
        toast.error(err?.message || 'Failed to load team members')
      } finally {
        if (mounted) setLoadingTeam(false)
      }
    }

    loadTeam()
    return () => { mounted = false }
  }, [])

  const closeMemberModal = () => {
    setMemberModal(null)
    setMemberForm(MEMBER_FORM_INITIAL)
  }

  const openInviteModal = () => {
    if (!canInvite) {
      toast.error('You do not have permission to invite members.')
      return
    }
    setMemberForm(MEMBER_FORM_INITIAL)
    setMemberModal({ mode: 'add', memberId: null })
  }

  const openEditModal = (member) => {
    if (!canUpdate) {
      toast.error('You do not have permission to edit members.')
      return
    }
    if (isManager && ['COMPANY_ADMIN', 'ADMIN'].includes(member.role)) {
      toast.error('Managers cannot edit admin users.')
      return
    }
    setMemberForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      password: '',
      role: member.role,
      status: member.status,
    })
    setMemberModal({ mode: 'edit', memberId: member.id })
  }

  const getAdminCount = () => team.filter((member) => ['COMPANY_ADMIN', 'ADMIN'].includes(member.role)).length

  const validateMemberForm = () => {
    const name = memberForm.name.trim()
    const email = memberForm.email.trim().toLowerCase()
    const phone = memberForm.phone.trim()
    const password = memberForm.password

    if (!name) {
      toast.error('Member name is required.')
      return null
    }
    if (!email) {
      toast.error('Member email is required.')
      return null
    }
    if (!EMAIL_REGEX.test(email)) {
      toast.error('Enter a valid email address.')
      return null
    }
    if (!phone) {
      toast.error('Phone number is required.')
      return null
    }
    if (!PHONE_REGEX.test(phone)) {
      toast.error('Enter a valid phone number.')
      return null
    }
    if (memberModal?.mode === 'add' && !password) {
      toast.error('Password is required for new members.')
      return null
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return null
    }
    if (!ROLE_CONFIG[memberForm.role]) {
      toast.error('Select a valid role.')
      return null
    }
    if (isManager && ['COMPANY_ADMIN', 'ADMIN'].includes(memberForm.role)) {
      toast.error('Managers can invite only Manager or Sales Executive.')
      return null
    }
    if (!['active', 'inactive'].includes(memberForm.status)) {
      toast.error('Select a valid status.')
      return null
    }

    const duplicateEmail = team.some((member) =>
      member.email.toLowerCase() === email &&
      member.id !== memberModal?.memberId
    )
    if (duplicateEmail) {
      toast.error('A member with this email already exists.')
      return null
    }

    return { name, email, phone, password }
  }

  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    const validated = validateMemberForm()
    if (!validated) return

    const { name, email, phone, password } = validated
    const avatar = name.charAt(0).toUpperCase() || 'U'

    if (memberModal?.mode === 'add') {
      try {
        const created = await teamAPI.invite({
          name,
          email,
          phone,
          password,
          role: memberForm.role,
          isActive: memberForm.status === 'active',
        })
        setTeam((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            email: created.email,
            phone: created.phone || '',
            role: created.role || memberForm.role,
            status: created.isActive === false ? 'inactive' : 'active',
            leads: 0,
            deals: 0,
            avatar,
            badge: '',
            joinedAt: '',
          },
        ])
        toast.success(`Member invited: ${name}`)
        closeMemberModal()
      } catch (err) {
        toast.error(err?.message || 'Failed to invite member')
      }
      return
    }

    const currentMember = team.find((member) => member.id === memberModal?.memberId)
    if (!currentMember) {
      toast.error('Member not found.')
      closeMemberModal()
      return
    }

    if (['COMPANY_ADMIN', 'ADMIN'].includes(currentMember.role) && !['COMPANY_ADMIN', 'ADMIN'].includes(memberForm.role) && getAdminCount() <= 1) {
      toast.error('At least one admin-like account is required.')
      return
    }

    try {
      const updatePayload = {
        name,
        email,
        phone,
        password: password || undefined,
      }
      if (isAdminLike) {
        updatePayload.role = memberForm.role
        updatePayload.isActive = memberForm.status === 'active'
      }

      const updated = await teamAPI.update(String(currentMember.id), updatePayload)
      setTeam((prev) =>
        prev.map((member) => {
          if (member.id !== currentMember.id) return member
          return {
            ...member,
            name: updated.name,
            email: updated.email,
            phone: updated.phone || '',
            role: updated.role || member.role,
            status: updated.isActive === false ? 'inactive' : 'active',
            avatar,
          }
        })
      )
      toast.success(`Updated ${name}`)
      closeMemberModal()
    } catch (err) {
      toast.error(err?.message || 'Failed to update member')
    }
  }

  const handleDeleteMember = (member) => {
    if (!canDeactivate) {
      toast.error('You do not have permission to deactivate members.')
      return
    }
    if (['COMPANY_ADMIN', 'ADMIN'].includes(member.role) && getAdminCount() <= 1) {
      toast.error('Cannot delete the last admin-like account.')
      return
    }
    setDeleteTarget(member)
  }

  const confirmDeleteMember = async () => {
    if (!deleteTarget) return
    try {
      await teamAPI.delete(String(deleteTarget.id))
      setTeam((prev) => prev.filter((member) => member.id !== deleteTarget.id))
      toast.success(`Deleted ${deleteTarget.name}`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err?.message || 'Failed to delete member')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" /> Team & Roles
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{team.length} members · Role-based access control</p>
        </div>
        {canInvite && (
          <button onClick={openInviteModal} className="btn-primary gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team list */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="sm:hidden divide-y divide-slate-200/60 dark:divide-slate-700/40">
            {loadingTeam && (
              <div className="py-8 px-4 text-center text-slate-500">
                Loading team members...
              </div>
            )}
            {!loadingTeam && team.length === 0 && (
              <div className="py-8 px-4 text-center text-slate-500">
                No team members found.
              </div>
            )}
            {!loadingTeam && team.map((member) => {
              const roleCfg = ROLE_CONFIG[member.role]
              return (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
                          {member.avatar}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${member.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{member.name}</p>
                        <CopyableContact value={member.email} label="Email" className="max-w-[180px] text-xs text-slate-500" />
                        <CopyableContact value={member.phone} label="Phone" className="max-w-[180px] text-xs text-slate-400" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={roleCfg?.cls}>{roleCfg?.label}</span>
                      <span className={`badge ${member.status === 'active' ? 'badge-won' : 'badge bg-slate-100 text-slate-500'}`}>
                        {member.status}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Performance</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {member.leads > 0 ? `${member.leads} leads · ${member.deals} deals` : (ROLE_PERFORMANCE_LABEL[member.role] || 'Sales account')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {canUpdate && (
                      <button
                        onClick={() => openEditModal(member)}
                        className="btn-secondary flex-1 text-xs gap-1.5"
                        aria-label={`Edit ${member.name}`}
                        title={`Edit ${member.name}`}
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {canDeactivate && (
                      <button
                        onClick={() => handleDeleteMember(member)}
                        className="btn-secondary flex-1 text-xs gap-1.5 text-red-600 dark:text-red-400"
                        aria-label={`Delete ${member.name}`}
                        title={`Delete ${member.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="hidden sm:table w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30">
                {['Member', 'Role', 'Status', 'Performance', 'Actions'].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/40">
              {loadingTeam && (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                    Loading team members...
                  </td>
                </tr>
              )}
              {!loadingTeam && team.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                    No team members found.
                  </td>
                </tr>
              )}
              {!loadingTeam && team.map((member) => {
                const roleCfg = ROLE_CONFIG[member.role]
                return (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
                            {member.avatar}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-white dark:border-slate-900 shadow-sm ${member.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{member.name} {member.badge}</p>
                          <CopyableContact value={member.email} label="Email" className="max-w-[220px] text-xs text-slate-500" />
                          <CopyableContact value={member.phone} label="Phone" className="max-w-[220px] text-xs text-slate-400" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={roleCfg?.cls}>{roleCfg?.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${member.status === 'active' ? 'badge-won' : 'badge bg-slate-100 text-slate-500'}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {member.leads > 0
                        ? `${member.leads} leads · ${member.deals} deals`
                        : (ROLE_PERFORMANCE_LABEL[member.role] || 'Sales account')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-500"
                            title={`Edit ${member.name}`}
                            aria-label={`Edit ${member.name}`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeactivate && (
                          <button
                            onClick={() => handleDeleteMember(member)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500"
                            title={`Delete ${member.name}`}
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        </div>

        {/* Role Permissions */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Role Permissions</h2>
              <p className="text-xs text-slate-500 mt-1">{selectedRolePermissions.length} backend permissions</p>
            </div>
            <Shield className="w-4 h-4 text-brand-500 mt-0.5" />
          </div>
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            {roleDefinitions.map((role) => (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={`flex-1 min-w-[92px] py-1.5 text-xs font-medium rounded-lg transition-all
                  ${selectedRole === role.value ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500'}`}
              >
                {role.label}
              </button>
            ))}
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {Object.entries(selectedPermissionGroups).map(([module, permissions]) => (
              <div key={module} className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{module.replace(/_/g, ' ')}</p>
                <div className="space-y-1.5">
                  {permissions.map((permission) => (
                    <div key={permission} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="min-w-0 truncate" title={permission}>{formatPermissionLabel(permission)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {selectedRolePermissions.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">
                No permissions returned for this role.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Monthly Leaderboard</h2>
          </div>
          {team.length > 0 && (
            <AvatarGroup users={team.slice(0, 6)} max={4} size="sm" showStatus />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveLeaderboard.map((member, idx) => (
            <div key={member.name} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center relative overflow-hidden">
              {idx === 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
              )}
              <div className="text-4xl mb-2">{member.badge}</div>
              <p className="font-bold text-slate-800 dark:text-slate-200">{member.name}</p>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
                ₹{(member.revenue / 100000).toFixed(1)}L
              </p>
              <div className="flex justify-center gap-2 mt-2">
                <Chip label={`${member.leads} leads`} variant="soft" color="primary" size="sm" />
                <Chip label={`${member.deals} deals`} variant="soft" color="success" size="sm" />
              </div>
              <div className="mt-3 px-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400">Conversion</span>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{member.convRate}%</span>
                </div>
                <LinearProgress value={Number(member.convRate)} color={Number(member.convRate) >= 50 ? 'success' : 'warning'} size="sm" />
              </div>
              <div className="mt-2">
                <Rating value={Math.min(5, Math.round(Number(member.convRate) / 20))} readOnly size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {memberModal && (
          <ScreenModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={memberModal.mode === 'add' ? 'Invite team member' : 'Edit team member'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMemberModal}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative glass-card w-full max-w-lg p-6 z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {memberModal.mode === 'add' ? 'Invite Member' : 'Edit Member'}
                </h2>
                <button onClick={closeMemberModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Full Name *</label>
                    <input
                      value={memberForm.name}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="input"
                      placeholder="Ramesh Patel"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email *</label>
                    <input
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="input"
                      placeholder="ramesh@internitecrm.com"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Phone Number *</label>
                    <input
                      value={memberForm.phone}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="input"
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Password {memberModal.mode === 'add' ? '*' : '(optional)'}
                    </label>
                    <input
                      type="password"
                      value={memberForm.password}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="input"
                      placeholder={memberModal.mode === 'add' ? 'Enter password' : 'Leave blank to keep current password'}
                    />
                  </div>
                  {(memberModal.mode === 'add' || isAdminLike) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Role</label>
                      <select
                        value={memberForm.role}
                        onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))}
                        className="input"
                      >
                        {roleOptions.map((roleKey) => (
                          <option key={roleKey} value={roleKey}>{ROLE_CONFIG[roleKey].label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {(memberModal.mode === 'add' || isAdminLike) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Status</label>
                      <select
                        value={memberForm.status}
                        onChange={(e) => setMemberForm((prev) => ({ ...prev, status: e.target.value }))}
                        className="input"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeMemberModal} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">
                    {memberModal.mode === 'add' ? 'Invite Member' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
            </div>
          </ScreenModalPortal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ScreenModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Delete team member">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative glass-card w-full max-w-md p-6 z-10"
            >
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Delete Member</h2>
              <p className="text-sm text-slate-500 mt-2">
                Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-slate-300">{deleteTarget.name}</span> from the team?
              </p>
              <div className="flex gap-3 pt-5">
                <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
                <button
                  type="button"
                  onClick={confirmDeleteMember}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                  Delete
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
