'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getUser, AuthUser } from '@/lib/auth'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

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
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} onUpdateUser={setUser} />

      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        <TopBar user={user} onUpdateUser={setUser} onOpenNav={() => setNavOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">{children}</main>
      </div>
    </div>
  )
}
