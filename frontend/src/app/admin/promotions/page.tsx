'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineShieldExclamation } from 'react-icons/hi2'

const ROLES = ['system_admin', 'dean', 'department_head', 'lecturer', 'on_study_leave']

export default function AdminPromotionsPage() {
  const [users,      setUsers]      = useState<any[]>([])
  const [promotions, setPromotions] = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      api.get('/users').catch(() => ({ data: { data: [] } })),
      api.get('/promotions').catch(() => ({ data: { data: [] } }))
    ]).then(([uRes, pRes]) => {
      setUsers(uRes.data.data ?? [])
      setPromotions(pRes.data.data ?? [])
    }).catch(err => {
      console.error(err)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  async function handleRoleChange(userId: number, newRole: string) {
    setLoading(true); setMsg(null)
    try {
      await api.post('/promotions', { user_id: userId, new_role: newRole })
      setMsg({ text: `User role updated to ${newRole.replace(/_/g, ' ')} successfully.`, ok: true })
      loadData()
    } catch(err:any) {
      setMsg({ text: err.response?.data?.message ?? 'Failed to update role.', ok: false })
    } finally { setLoading(false) }
  }

  async function resolve(id: number, action: 'approve'|'reject') {
    setLoading(true); setMsg(null)
    try {
      await api.patch(`/promotions/${id}`, { action })
      setMsg({ text: `Promotion ${action}d successfully.`, ok: true })
      loadData()
    } catch(err:any) {
      setMsg({ text: err.response?.data?.message ?? 'Action failed.', ok: false })
    } finally { setLoading(false) }
  }

  const statusBadge = (s:string) => {
    const map: Record<string,string> = {
      pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return map[s] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
  }

  const roleBadgeColor = (r: string) => {
    const map: Record<string, string> = {
      system_admin:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      dean:            'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      department_head: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      lecturer:        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      on_study_leave:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    }
    return map[r] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
  }

  const nonStudents = users.filter(u => u.role_name !== 'student')
  const pending     = promotions.filter(p => p.status === 'pending')
  const resolved    = promotions.filter(p => p.status !== 'pending')

  return (
    <DashboardLayout requiredRole="system_admin">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Role Management & Promotions</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Change user roles and manage promotion workflows</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-6 rounded-xl px-4 py-3 text-sm border ${msg.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Active User Roles Table */}
      <div className="glass-card mb-8">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="font-heading font-semibold text-lg">Active User Roles</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Quickly change roles for system administrators, deans, heads, and lecturers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Name', 'Email', 'Department', 'Current Role', 'Change Role'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[var(--muted)] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nonStudents.map((u: any) => (
                <tr key={u.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg)]/50 transition-colors">
                  <td className="py-3.5 px-4 font-semibold">{u.full_name}</td>
                  <td className="py-3.5 px-4 text-[var(--muted)]">{u.email}</td>
                  <td className="py-3.5 px-4 text-[var(--muted)]">{u.dept_name ?? '—'}</td>
                  <td className="py-3.5 px-4">
                    <span className={`badge ${roleBadgeColor(u.role_name)}`}>
                      {(u.role_name ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={u.role_name}
                      disabled={loading}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="input py-1.5 px-3 max-w-[180px] text-xs outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>
                          {r.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {nonStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--muted)]">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Approvals (Dean Initiated) */}
      {pending.length > 0 && (
        <div className="glass-card mb-8">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-2">
            <HiOutlineShieldExclamation className="text-amber-500" size={20}/>
            <h2 className="font-heading font-semibold text-lg">Pending Dean Approvals</h2>
          </div>
          <div className="divide-y divide-[var(--border)]/50">
            {pending.map((p:any) => (
              <div key={p.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium">{p.user_name}</p>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    <span className="line-through">{(p.old_role ?? '').replace(/_/g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                    {' → '}
                    <strong className="text-indigo-500">{(p.new_role ?? '').replace(/_/g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</strong>
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">Initiated by: {p.promoted_by_name ?? '—'} · {new Date(p.promoted_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={loading} onClick={() => resolve(p.id, 'approve')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-sm font-medium transition-colors">
                    <HiOutlineCheckCircle size={15}/> Approve
                  </button>
                  <button disabled={loading} onClick={() => resolve(p.id, 'reject')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors">
                    <HiOutlineXCircle size={15}/> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {resolved.length > 0 && (
        <div className="glass-card">
          <div className="p-5 border-b border-[var(--border)]">
            <h2 className="font-heading font-semibold text-lg">Promotion & Role Change History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['User','Old Role','New Role','Changed By','Status','Date'].map(h=>(
                    <th key={h} className="text-left py-3 px-4 text-[var(--muted)] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resolved.map((p:any) => (
                  <tr key={p.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg)]/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{p.user_name}</td>
                    <td className="py-3 px-4 text-[var(--muted)]">{(p.old_role ?? '').replace(/_/g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</td>
                    <td className="py-3 px-4 text-indigo-400 font-medium">{(p.new_role ?? '').replace(/_/g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</td>
                    <td className="py-3 px-4 text-[var(--muted)]">{p.promoted_by_name ?? '—'}</td>
                    <td className="py-3 px-4"><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                    <td className="py-3 px-4 text-[var(--muted)]">{new Date(p.promoted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
