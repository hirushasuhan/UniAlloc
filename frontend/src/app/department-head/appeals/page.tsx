'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import { HiOutlineXMark } from 'react-icons/hi2'

export default function DeptHeadAppealsPage() {
  const [appeals,  setAppeals]  = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [note,     setNote]     = useState('')
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null)

  const load = () => api.get('/appeals').then(r => setAppeals(r.data.data ?? []))
  useEffect(() => { load() }, [])

  async function resolve(status:'reviewed'|'resolved') {
    if (!selected) return
    try {
      await api.patch(`/appeals/${selected.id}`, { status, review_note: note })
      setMsg({ text: `Appeal ${status}.`, ok: true })
      setSelected(null); setNote(''); load()
    } catch(e:any) { setMsg({ text: e.response?.data?.message ?? 'Error', ok: false }) }
  }

  const STATUS_COLOR: Record<string,string> = {
    pending:'bg-amber-100 text-amber-700', reviewed:'bg-blue-100 text-blue-700', resolved:'bg-green-100 text-green-700'
  }

  return (
    <DashboardLayout requiredRole="department_head">
      <h1 className="text-2xl font-heading font-bold mb-2">Workload Appeals</h1>
      <p className="text-[var(--muted)] text-sm mb-6">Review appeals submitted by lecturers in your department</p>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok?'bg-green-500/10 border border-green-500/30 text-green-600':'bg-red-500/10 border border-red-500/30 text-red-500'}`}>
          {msg.text}
        </div>
      )}

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)]">
            {['Lecturer','Assignment','Reason','Status','Submitted','Action'].map(h=>(
              <th key={h} className="text-left py-3 px-4 text-[var(--muted)] font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {appeals.map((a:any) => (
              <tr key={a.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg)]/50">
                <td className="py-3 px-4 font-medium">{a.lecturer_name}</td>
                <td className="py-3 px-4 text-[var(--muted)]">{a.assignment_title ?? '—'}</td>
                <td className="py-3 px-4 max-w-[220px] truncate text-[var(--muted)]">{a.reason}</td>
                <td className="py-3 px-4"><span className={`badge ${STATUS_COLOR[a.status]}`}>{a.status}</span></td>
                <td className="py-3 px-4 text-[var(--muted)]">{new Date(a.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  {a.status === 'pending' && (
                    <button onClick={() => { setSelected(a); setNote('') }}
                      className="text-xs text-indigo-500 hover:underline">Review</button>
                  )}
                </td>
              </tr>
            ))}
            {appeals.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">No appeals found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 relative">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-[var(--muted)]"><HiOutlineXMark size={18}/></button>
            <h2 className="font-heading font-semibold text-lg mb-1">Review Appeal</h2>
            <p className="text-sm text-[var(--muted)] mb-3">From: <strong>{selected.lecturer_name}</strong></p>
            <div className="bg-[var(--bg)] rounded-xl p-3 mb-4 text-sm">{selected.reason}</div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Review Note (optional)</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} className="input" rows={3} placeholder="Your response…"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => resolve('reviewed')} className="btn-secondary flex-1 justify-center">Mark Reviewed</button>
              <button onClick={() => resolve('resolved')} className="btn-primary flex-1 justify-center">Resolve</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
