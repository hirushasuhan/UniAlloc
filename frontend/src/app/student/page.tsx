'use client'
import { useEffect, useState, FormEvent } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import DashboardBanner from '@/components/ui/DashboardBanner'
import { getUser } from '@/lib/auth'

export default function StudentPortal() {
  const [requests, setRequests] = useState<any[]>([])
  const [name,     setName]     = useState('')
  const [enrollment, setEnrollment] = useState('')
  const [contact,  setContact]  = useState('')
  const [title,    setTitle]    = useState('')
  const [desc,     setDesc]     = useState('')
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)
  const [loading,  setLoading]  = useState(false)

  const load = () => api.get('/student-requests').then(r => setRequests(r.data.data ?? []))
  useEffect(() => {
    load()
    const u = getUser()
    if (u) {
      setName(u.full_name || '')
      setEnrollment((u as any).enrollment_number || '')
      setContact((u as any).contact || '')
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      await api.post('/student-requests', {
        title,
        description: desc,
        name,
        enrollment_number: enrollment,
        contact
      })
      setMsg({ text: 'Request submitted successfully! The Dean will review it shortly.', ok: true })
      setTitle(''); setDesc('')
      load()
    } catch (err: any) {
      setMsg({ text: err.response?.data?.message ?? 'Submission failed.', ok: false })
    } finally {
      setLoading(false)
    }
  }

  const statusColor: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-700',
    assigned: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <DashboardLayout requiredRole="student">
      <DashboardBanner />
      <h1 className="text-2xl font-heading font-bold mb-2">Student Dashboard</h1>
      <p className="text-[var(--muted)] text-sm mb-8">Request and track supervisor allocations</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Form */}
        <div className="glass-card p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">New Supervisor Request</h2>

          {msg && (
            <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-green-500/10 border border-green-500/30 text-green-600' : 'bg-red-500/10 border border-red-500/30 text-red-500'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" required
                placeholder="Your full name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Enrollment Number *</label>
                <input value={enrollment} onChange={e => setEnrollment(e.target.value)} className="input" required
                  placeholder="e.g. UWU/IIT/23/099" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Contact Number *</label>
                <input value={contact} onChange={e => setContact(e.target.value)} className="input" required
                  placeholder="e.g. +94771234567" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Request Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input" required
                placeholder="e.g. Final Year Project Supervision — Machine Learning" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} className="input" rows={4}
                placeholder="Briefly describe your project, preferred expertise, and any specific requirements…" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* My Requests */}
        <div className="glass-card p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">My Requests</h2>
          {requests.length === 0
            ? <p className="text-[var(--muted)] text-sm">No requests submitted yet.</p>
            : (
              <div className="space-y-4">
                {requests.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-semibold text-sm">{r.title}</p>
                      <span className={`badge flex-shrink-0 ${statusColor[r.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.description && <p className="text-xs text-[var(--muted)] line-clamp-2">{r.description}</p>}
                    {r.assigned_to_name && (
                      <p className="text-xs text-indigo-500 mt-1.5">Supervisor: {r.assigned_to_name}</p>
                    )}
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Submitted {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </DashboardLayout>
  )
}
