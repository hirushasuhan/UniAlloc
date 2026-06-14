'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { HiOutlineExclamationTriangle } from 'react-icons/hi2'
import DashboardBanner from '@/components/ui/DashboardBanner'

export default function DeptHeadDashboard() {
  const [workload,     setWorkload]     = useState<any[]>([])
  const [assignments,  setAssignments]  = useState<any[]>([])
  const [inboxReqs,    setInboxReqs]    = useState<any[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = () => {
    api.get('/capacity').then(r => setWorkload(r.data.data ?? []))
    api.get('/assignments').then(r => setAssignments(r.data.data ?? []))
    api.get('/work-requests').then(r => setInboxReqs(r.data.data ?? []))
  }

  async function updateWorkReqStatus(id: number, action: string) {
    try {
      await api.patch(`/work-requests/${id}`, { action })
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const overloaded = workload.filter(w => w.is_overloaded)

  return (
    <DashboardLayout requiredRole="department_head">
      <DashboardBanner />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Department Head Dashboard</h1>
          <p className="text-[var(--muted)] text-sm">Manage your department's assignments and workload</p>
        </div>
      </div>

      {overloaded.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-start gap-3">
          <HiOutlineExclamationTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-red-600">Overload Alert</p>
            <p className="text-sm text-red-500">{overloaded.map(w => w.full_name).join(', ')} exceeded capacity threshold.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Chart */}
        <div className="glass-card p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Department Workload</h2>
          {workload.length === 0
            ? <p className="text-[var(--muted)] text-sm">No data available.</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workload}>
                  <XAxis dataKey="full_name" tick={{ fontSize: 11 }}/>
                  <YAxis domain={[0,100]} unit="%" tick={{ fontSize: 11 }}/>
                  <Tooltip formatter={(v: number) => `${v}%`}/>
                  <Bar dataKey="utilization_pct" radius={[6,6,0,0]}>
                    {workload.map((w, i) => (
                      <Cell key={i} fill={w.is_overloaded ? '#ef4444' : '#10b981'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Cross-dept Request Inbox */}
        <div className="glass-card p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Incoming Requests</h2>
          {inboxReqs.length === 0
            ? <p className="text-[var(--muted)] text-sm">No pending requests.</p>
            : (
              <div className="space-y-3">
                {inboxReqs.filter(r => r.status === 'pending').slice(0, 5).map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl bg-[var(--bg)] flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-[var(--muted)]">from {r.requester_name}</p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => updateWorkReqStatus(r.id, 'approve')} className="text-[10px] font-semibold bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100">Approve</button>
                        <button onClick={() => updateWorkReqStatus(r.id, 'reject')} className="text-[10px] font-semibold bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100">Reject</button>
                      </div>
                    </div>
                    <span className="badge bg-amber-100 text-amber-700">pending</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Recent Assignments */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="font-heading font-semibold text-lg mb-4">Recent Assignments</h2>
          {assignments.length === 0
            ? <p className="text-[var(--muted)] text-sm">No assignments found.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      {['Title','Assigned To','Priority','Deadline','Status'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-[var(--muted)] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.slice(0, 10).map((a: any) => (
                      <tr key={a.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg)]/50">
                        <td className="py-2 px-3 font-medium">{a.title}</td>
                        <td className="py-2 px-3 text-[var(--muted)]">{a.assigned_to_name}</td>
                        <td className="py-2 px-3">
                          <span className={`badge ${a.priority === 'urgent' ? 'bg-red-100 text-red-700' : a.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                            {a.priority}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--muted)]">{a.deadline ?? '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`badge ${a.status === 'completed' ? 'bg-green-100 text-green-700' : a.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    </DashboardLayout>
  )
}
