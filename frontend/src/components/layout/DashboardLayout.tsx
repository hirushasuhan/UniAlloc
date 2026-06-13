'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getUser, AuthUser } from '@/lib/auth'
import Sidebar from './Sidebar'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { HiOutlineBars3 } from 'react-icons/hi2'

export default function DashboardLayout({ children, requiredRole }: {
  children: React.ReactNode
  requiredRole?: string | string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace('/login'); return }
    if (requiredRole) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (!allowed.includes(u.role)) { router.replace('/login'); return }
    }
    setUser(u)
  }, [])

  // Close the mobile drawer on route change
  useEffect(() => { setNavOpen(false) }, [pathname])

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin"/>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="glass-panel sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95"
          >
            <HiOutlineBars3 size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="UniAlloc" className="w-7 h-7 object-contain" />
            <span className="font-heading font-extrabold text-base tracking-tight">
              <span className="text-gradient">Uni</span>Alloc
            </span>
          </div>
          <div className="ml-auto">
            <ThemeToggle compact />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">{children}</main>
      </div>
    </div>
  )
}
