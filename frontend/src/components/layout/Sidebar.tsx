'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clearAuth, AuthUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { HiOutlineSquares2X2, HiOutlineUsers, HiOutlineBookOpen, HiOutlineChartBar, HiOutlineBell, HiOutlineCog6Tooth, HiOutlineArrowRightOnRectangle, HiOutlineDocumentText, HiOutlinePaperAirplane, HiOutlineTrophy, HiOutlineClipboardDocumentList, HiOutlineBriefcase, HiOutlineInbox, HiOutlineXMark } from 'react-icons/hi2'

interface NavItem { href: string; label: string; icon: React.ReactNode }

function navItems(role: string): NavItem[] {
  const base = [{ href: `/${roleSlug(role)}`,      label: 'Dashboard',    icon: <HiOutlineSquares2X2 size={18}/> }]

  const byRole: Record<string, NavItem[]> = {
    system_admin: [
      { href: '/admin/users',       label: 'Users',        icon: <HiOutlineUsers size={18}/> },
      { href: '/admin/faculties',   label: 'Faculties',    icon: <HiOutlineBookOpen size={18}/> },
      { href: '/admin/promotions',  label: 'Promotions',   icon: <HiOutlineTrophy size={18}/> },
      { href: '/admin/audit-logs',  label: 'Audit Logs',   icon: <HiOutlineDocumentText size={18}/> },
      { href: '/admin/settings',    label: 'Settings',     icon: <HiOutlineCog6Tooth size={18}/> },
    ],
    dean: [
      { href: '/dean/assignments',     label: 'Assignments',     icon: <HiOutlineClipboardDocumentList size={18}/> },
      { href: '/dean/workload',        label: 'Workload',        icon: <HiOutlineChartBar size={18}/> },
      { href: '/dean/requests',        label: 'Requests',        icon: <HiOutlinePaperAirplane size={18}/> },
      { href: '/dean/student-requests',label: 'Student Requests',icon: <HiOutlineUsers size={18}/> },
      { href: '/dean/my-work',         label: 'My Work',         icon: <HiOutlineBriefcase size={18}/> },
    ],
    department_head: [
      { href: '/department-head/assignments', label: 'Assignments', icon: <HiOutlineClipboardDocumentList size={18}/> },
      { href: '/department-head/workload',    label: 'Workload',    icon: <HiOutlineChartBar size={18}/> },
      { href: '/department-head/requests',    label: 'Requests',    icon: <HiOutlinePaperAirplane size={18}/> },
      { href: '/department-head/appeals',     label: 'Appeals',     icon: <HiOutlineDocumentText size={18}/> },
      { href: '/department-head/my-work',     label: 'My Work',     icon: <HiOutlineBriefcase size={18}/> },
    ],
    lecturer: [
      { href: '/lecturer/assignments', label: 'My Assignments', icon: <HiOutlineClipboardDocumentList size={18}/> },
      { href: '/lecturer/workload',    label: 'My Workload',    icon: <HiOutlineChartBar size={18}/> },
      { href: '/lecturer/appeals',     label: 'Appeals',        icon: <HiOutlineDocumentText size={18}/> },
      { href: '/lecturer/requests',    label: 'Work Requests',  icon: <HiOutlineInbox size={18}/> },
    ],
    student: [
      { href: '/student/requests',     label: 'My Requests',    icon: <HiOutlinePaperAirplane size={18}/> },
    ],
  }

  return [
    ...base,
    ...(byRole[role] ?? []),
    { href: '/notifications', label: 'Notifications', icon: <HiOutlineBell size={18}/> },
  ]
}

function roleSlug(role: string) {
  return { system_admin: 'admin', dean: 'dean', department_head: 'department-head', lecturer: 'lecturer', student: 'student' }[role] ?? 'login'
}

export default function Sidebar({ user, open = false, onClose }: { user: AuthUser; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()
  const items    = navItems(user.role)

  function logout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
      />

      <aside
        className={`glass-panel fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col border-r border-[var(--border)] px-4 py-6 gap-2
          transform transition-transform duration-300 ease-out
          lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:h-screen
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo + mobile close */}
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--card)] border border-[var(--border-strong)] shadow-sm overflow-hidden">
            <img src="/logo.png" alt="UniAlloc" className="w-7 h-7 object-contain" />
          </div>
          <span className="font-heading font-extrabold text-lg tracking-tight">
            <span className="text-gradient">Uni</span>Alloc
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-colors"
          >
            <HiOutlineXMark size={20} />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider mb-2 border border-[var(--border)]"
          style={{ background: 'linear-gradient(120deg, rgba(var(--accent-rgb),0.14), rgba(var(--accent-2-rgb),0.14))', color: 'var(--accent)' }}>
          {user.role.replace('_', ' ')}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto pr-1 custom-scrollbar">
          {items.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'text-white shadow-[0_8px_22px_-10px_rgba(var(--accent-2-rgb),0.7)]'
                    : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)]'
                  }`}
                style={active ? { background: 'linear-gradient(120deg, var(--accent), var(--accent-2))' } : undefined}>
                {!active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-0 w-1 rounded-full bg-[var(--accent)] group-hover:h-5 transition-all" />}
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Theme toggle */}
        <div className="mt-4">
          <ThemeToggle />
        </div>

        {/* User + logout */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
              {user.full_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-[var(--muted)] truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <HiOutlineArrowRightOnRectangle size={16}/> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
