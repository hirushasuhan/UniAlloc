'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import { HiOutlineXMark } from 'react-icons/hi2'

export default function DeptHeadStudentRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [users,    setUsers]    = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [assignTo, setAssignTo] = useState('')
  const [priority, setPriority] = useState('medium')
  const [estHours, setEstHours] = useState('4')
  const [deadline, setDeadline] = useState('')
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null)

  // Today's date (local) in YYYY-MM-DD — deadline can't be in the past
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const openReview = (r: any) => {
    setSelected(r); setAssignTo(''); setPriority('medium'); setEstHours('4'); setDeadline('')
  }

  const load = () => api.get('/student-requests').then(r => setRequests(r.data.data ?? []))
  useEffect(() => {
    load()
    api.get('/users').then(r => setUsers(r.data.data ?? []))
  }, [])

  // /users is already scoped to the department for dept heads
  const assignable = users.filter(u => ['lecturer','department_head'].includes(u.role_name))

  async function handleResolve(status: 'assigned'|'rejected') {
    if (!selected) return
    try {
      await api.patch(`/student-requests/${selected.id}`, {
        status,
        assigned_to: status === 'assigned' && assignTo ? parseInt(assignTo) : null,
        ...(status === 'assigned' ? {
          priority,
          estimated_hours: parseFloat(estHours) || 4,
          deadline: deadline || null
        } : {})
      })
      setMsg({ text: status === 'assigned' ? 'Request approved — a supervision task was created for the lecturer.' : 'Request rejected.', ok: true })
      setSelected(null); setAssignTo(''); load()
    } catch(e:any) { setMsg({ text: e.response?.data?.message ?? 'Error', ok: false }) }
  }

  const STATUS_COLOR: Record<string,string> = {
    pending:'bg-amber-100 text-amber-700', assigned:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700'
  }

  return (
    <DashboardLayout requiredRole="department_head">
      <h1 className="text-2xl font-heading font-bold mb-2">Student Supervisor Requests</h1>
      <p className="text-[var(--muted)] text-sm mb-6">Review and assign supervisors to students requesting your department</p>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok?'bg-green-500/10 border border-green-500/30 text-green-600':'bg-red-500/10 border border-red-500/30 text-red-500'}`}>
          {msg.text}
        </div>
      )}

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)]">
            {['Student','Title','Description','Status','Supervisor','Action'].map(h=>(
              <th key={h} className="text-left py-3 px-4 text-[var(--muted)] font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {requests.map((r:any) => (
              <tr key={r.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg)]/50">
                <td className="py-3 px-4 font-medium">{r.student_name}</td>
                <td className="py-3 px-4 max-w-[180px] truncate font-medium">{r.title}</td>
                <td className="py-3 px-4 text-[var(--muted)] max-w-[200px] truncate">{r.description ?? '—'}</td>
                <td className="py-3 px-4"><span className={`badge ${STATUS_COLOR[r.status]}`}>{r.status}</span></td>
                <td className="py-3 px-4 text-[var(--muted)]">{r.assigned_to_name ?? '—'}</td>
                <td className="py-3 px-4">
                  {r.status === 'pending' && (
                    <button onClick={() => openReview(r)}
                      className="text-xs text-indigo-500 hover:underline font-medium">
                      Review
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">No student requests for your department.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 relative">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"><HiOutlineXMark size={18}/></button>
            <h2 className="font-heading font-semibold text-lg mb-2">Review Student Request</h2>
            <div className="text-sm text-[var(--muted)] mb-4 space-y-1 bg-white/5 p-3 rounded-xl border border-white/10">
              <p>Student Name: <strong className="text-white">{selected.student_name}</strong></p>
              <p>Enrollment No: <strong className="text-white">{selected.student_enrollment ?? '—'}</strong></p>
              <p>Contact No: <strong className="text-white">{selected.student_contact ?? '—'}</strong></p>
            </div>
            <p className="font-semibold mb-1">{selected.title}</p>
            {selected.description && <p className="text-sm text-[var(--muted)] mb-4">{selected.description}</p>}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Assign Supervisor</label>
              <select value={assignTo} onChange={e=>setAssignTo(e.target.value)} className="input">
                <option value="">— Select a supervisor —</option>
                {assignable.map((u:any) => (
                  <option key={u.id} value={u.id}>{u.position ? `${u.position}. ` : ''}{u.full_name} ({u.role_name.replace('_',' ')})</option>
                ))}
              </select>
            </div>
            {/* Supervision task details — appears in the supervisor's My Work like a normal assignment */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Priority</label>
                <select value={priority} onChange={e=>setPriority(e.target.value)} className="input">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Est. Hours</label>
                <input type="number" value={estHours} onChange={e=>setEstHours(e.target.value)} className="input" min="0.5" step="0.5"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Deadline</label>
                <input type="date" min={today} value={deadline} onChange={e=>setDeadline(e.target.value)} className="input"/>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleResolve('assigned')} disabled={!assignTo}
                className="btn-primary flex-1 justify-center">Assign & Approve</button>
              <button onClick={() => handleResolve('rejected')}
                className="flex-1 px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
