'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AuthUser } from '@/lib/auth'
import ThemeToggle from '@/components/ui/ThemeToggle'
import SettingsModal from '@/components/ui/SettingsModal'
import ChangePasswordModal from '@/components/ui/ChangePasswordModal'
import { HiOutlineBell, HiOutlineBars3 } from 'react-icons/hi2'
import { api } from '@/lib/api'

interface Props {
  user: AuthUser
  onUpdateUser: (updated: AuthUser) => void
  onOpenNav: () => void
}

export default function TopBar({ user, onUpdateUser, onOpenNav }: Props) {
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    // Only fetch when the dropdown is opened, or just fetch once
    api.get('/notifications').then(r => {
      // Show top 5 recent notifications
      setNotifications(r.data.data?.slice(0, 5) ?? [])
    }).catch(() => {})
  }, [])
  
  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]">
        {/* Left Side: Mobile Menu Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={onOpenNav}
            aria-label="Open menu"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95"
          >
            <HiOutlineBars3 size={20} />
          </button>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            >
              <HiOutlineBell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--card)]" />
              )}
            </button>
            
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-[var(--card-solid)] border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-[var(--border)]">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-[var(--muted)]">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-4 border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer ${!n.is_read ? 'bg-[var(--bg)]/50' : ''}`}>
                          <p className={`text-sm ${!n.is_read ? 'font-semibold' : ''}`}>{n.message}</p>
                          <p className="text-xs text-[var(--muted)] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <Link href="/notifications" onClick={() => setShowNotifications(false)} className="block p-3 text-center text-sm text-[var(--accent)] hover:underline cursor-pointer">
                    View all notifications
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Profile */}
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm hover:scale-105 transition-transform"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            {user.full_name[0].toUpperCase()}
          </button>
        </div>
      </header>

      {showSettingsModal && (
        <SettingsModal 
          user={user} 
          onClose={() => setShowSettingsModal(false)} 
          onChangePasswordClick={() => {
            setShowSettingsModal(false)
            setShowPasswordModal(true)
          }}
          onUpdateUser={onUpdateUser}
        />
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </>
  )
}
