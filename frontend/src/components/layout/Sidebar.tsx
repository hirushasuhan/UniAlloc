'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clearAuth, AuthUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, BookOpen, BarChart2, Bell,
  Settings, LogOut, FileText, Send, Award, ClipboardList, Briefcase, Inbox
} from 'lucide-react'

interface NavItem { href: string; label: string; icon: React.ReactNode }

function navItems(role: string): NavItem[] {
  const base = [{ href: `/${roleSlug(role)}`,      label: 'Dashboard',    icon: <LayoutDashboard size={18}/> }]

  const byRole: Record<string, NavItem[]> = {
    system_admin: [
      { href: '/admin/users',       label: 'Users',        icon: <Users size={18}/> },
      { href: '/admin/faculties',   label: 'Faculties',    icon: <BookOpen size={18}/> },
      { href: '/admin/promotions',  label: 'Promotions',   icon: <Award size={18}/> },
      { href: '/admin/audit-logs',  label: 'Audit Logs',   icon: <FileText size={18}/> },
      { href: '/admin/settings',    label: 'Settings',     icon: <Settings size={18}/> },
    ],
    dean: [
      { href: '/dean/assignments',     label: 'Assignments',     icon: <ClipboardList size={18}/> },
      { href: '/dean/workload',        label: 'Workload',        icon: <BarChart2 size={18}/> },
      { href: '/dean/requests',        label: 'Requests',        icon: <Send size={18}/> },
      { href: '/dean/student-requests',label: 'Student Requests',icon: <Users size={18}/> },
      { href: '/dean/my-work',         label: 'My Work',         icon: <Briefcase size={18}/> },
    ],
    department_head: [
      { href: '/department-head/assignments', label: 'Assignments', icon: <ClipboardList size={18}/> },
      { href: '/department-head/workload',    label: 'Workload',    icon: <BarChart2 size={18}/> },
      { href: '/department-head/requests',    label: 'Requests',    icon: <Send size={18}/> },
      { href: '/department-head/appeals',     label: 'Appeals',     icon: <FileText size={18}/> },
      { href: '/department-head/my-work',     label: 'My Work',     icon: <Briefcase size={18}/> },
    ],
    lecturer: [
      { href: '/lecturer/assignments', label: 'My Assignments', icon: <ClipboardList size={18}/> },
      { href: '/lecturer/workload',    label: 'My Workload',    icon: <BarChart2 size={18}/> },
      { href: '/lecturer/appeals',     label: 'Appeals',        icon: <FileText size={18}/> },
      { href: '/lecturer/requests',    label: 'Work Requests',  icon: <Inbox size={18}/> },
    ],
    student: [
      { href: '/student/requests',     label: 'My Requests',    icon: <Send size={18}/> },
    ],
  }

  return [
    ...base,
    ...(byRole[role] ?? []),
    { href: '/notifications', label: 'Notifications', icon: <Bell size={18}/> },
  ]
}

function roleSlug(role: string) {
  return { system_admin: 'admin', dean: 'dean', department_head: 'department-head', lecturer: 'lecturer', student: 'student' }[role] ?? 'login'
}

export default function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const router   = useRouter()
  const items    = navItems(user.role)

  function logout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[var(--card)] border-r border-[var(--border)] px-4 py-6 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow">
          <BookOpen size={18} className="text-white"/>
        </div>
        <span className="font-heading font-bold text-lg">UniAlloc</span>
      </div>

      {/* Role badge */}
      <div className="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-500 text-xs font-semibold uppercase tracking-wider mb-2">
        {user.role.replace('_', ' ')}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto pr-1 custom-scrollbar">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${active
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                }`}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
            {user.full_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-[var(--muted)] truncate">{user.email}</p>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <LogOut size={16}/> Sign out
        </button>
      </div>
    </aside>
  )
}
