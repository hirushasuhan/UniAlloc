'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import { Briefcase } from 'lucide-react'

export default function DeptHeadMyWorkPage() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [updating,    setUpdating]    = useState<number | null>(null)
  const [pct,         setPct]         = useState(0)
  const [note,        setNote]        = useState('')
  const [msg,         setMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  const load = () =>
    api.get('/assignments?my=1').then(r => setAssignments(r.data.data ?? []))

  useEffect(() => { load() }, [])

  async function saveProgress(id: number) {
    try {
      await api.patch(`/assignments/${id}/progress`, { progress_percent: pct, note })
      setMsg({ text: 'Progress updated.', ok: true })
      setUpdating(null)
      load()
    } catch (e: any) {
      setMsg({ text: e.response?.data?.message ?? 'Error', ok: false })
    }
  }

  const active    = assignments.filter(a => a.status !== 'completed' && a.status !== 'cancelled')
  const completed = assignments.filter(a => a.status === 'completed')

  return (
    <DashboardLayout requiredRole="department_head">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white">
          <Briefcase size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold">My Work</h1>
          <p className="text-[var(--muted)] text-sm">
            {active.length} active · {completed.length} completed
          </p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok
          ? 'bg-green-500/10 border border-green-500/30 text-green-600'
          : 'bg-red-500/10 border border-red-500/30 text-red-500'}`}>
          {msg.text}
        </div>
      )}

      {assignments.length === 0 && (
        <div className="glass-card p-10 text-center">
          <Briefcase size={32} className="mx-auto text-[var(--muted)] mb-3 opacity-40" />
          <p className="text-[var(--muted)]">No assignments have been assigned to you yet.</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="font-heading font-semibold text-base">Active Assignments</h2>
          {active.map((a: any) => (
            <WorkCard key={a.id} a={a}
              updating={updating} pct={pct} note={note}
              onOpen={() => { setUpdating(a.id); setPct(a.latest_progress ?? 0); setNote('') }}
              onPct={setPct} onNote={setNote}
              onSave={() => saveProgress(a.id)}
              onClose={() => setUpdating(null)} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading font-semibold text-base text-[var(--muted)]">Completed</h2>
          {completed.map((a: any) => (
            <WorkCard key={a.id} a={a} updating={null} pct={0} note=""
              onOpen={() => {}} onPct={() => {}} onNote={() => {}}
              onSave={() => {}} onClose={() => {}} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}

function WorkCard({ a, updating, pct, note, onOpen, onPct, onNote, onSave, onClose }: any) {
  const PRIORITY_COLOR: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-700',
  }
  const isActive = a.status !== 'completed' && a.status !== 'cancelled'

  return (
    <div className={`glass-card p-5 ${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge text-xs ${PRIORITY_COLOR[a.priority] ?? ''}`}>{a.priority}</span>
            {a.deadline && <span className="text-xs text-[var(--muted)]">Due: {a.deadline}</span>}
          </div>
          <h3 className="font-semibold">{a.title}</h3>
          {a.description && <p className="text-sm text-[var(--muted)] mt-1">{a.description}</p>}
          <p className="text-xs text-[var(--muted)] mt-1">
            From: {a.assigned_by_name} · {a.estimated_hours}h estimated
          </p>
        </div>
        <span className={`badge flex-shrink-0 ${
          a.status === 'completed'   ? 'bg-green-100 text-green-700' :
          a.status === 'in_progress' ? 'bg-blue-100 text-blue-700'  :
                                       'bg-amber-100 text-amber-700'
        }`}>
          {a.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-2.5 rounded-full bg-[var(--border)]">
          <div className="h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all"
            style={{ width: `${a.latest_progress ?? 0}%` }} />
        </div>
        <span className="text-sm font-medium w-10 text-right">{a.latest_progress ?? 0}%</span>
      </div>

      {isActive && (
        updating === a.id ? (
          <div className="space-y-3 bg-[var(--bg)] rounded-xl p-4">
            <div>
              <label className="block text-sm font-medium mb-1">Progress: {pct}%</label>
              <input type="range" min={0} max={100} step={5} value={pct}
                onChange={e => onPct(+e.target.value)} className="w-full accent-teal-500" />
            </div>
            <textarea placeholder="Add a note (optional)…" rows={2}
              value={note} onChange={e => onNote(e.target.value)} className="input text-sm" />
            <div className="flex gap-2">
              <button onClick={onSave} className="btn-primary text-sm py-2 px-4">Save</button>
              <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={onOpen} className="text-sm text-teal-600 hover:underline font-medium">
            Update progress →
          </button>
        )
      )}
    </div>
  )
}
