export interface AuthUser {
  id: number
  full_name: string
  email: string
  role: 'system_admin' | 'dean' | 'department_head' | 'lecturer' | 'student'
  dept_id: number | null
  faculty_id: number | null
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('ua_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('ua_token')
}

export function saveAuth(token: string, user: AuthUser): void {
  localStorage.setItem('ua_token', token)
  localStorage.setItem('ua_user', JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem('ua_token')
  localStorage.removeItem('ua_user')
}

export function roleHome(role: string): string {
  const map: Record<string, string> = {
    system_admin:    '/admin',
    dean:            '/dean',
    department_head: '/department-head',
    lecturer:        '/lecturer',
    student:         '/student',
  }
  return map[role] ?? '/login'
}
