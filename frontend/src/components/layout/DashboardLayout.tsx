'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, AuthUser } from '@/lib/auth'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children, requiredRole }: {
  children: React.ReactNode
  requiredRole?: string | string[]
}) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace('/login'); return }
    if (requiredRole) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (!allowed.includes(u.role)) { router.replace('/login'); return }
    }
    setUser(u)
  }, [])

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"/>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar user={user}/>
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
