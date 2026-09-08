import axios from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'

export const api = axios.create({ baseURL: BASE })

// Attach JWT from sessionStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('ua_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global auth failure handling.
//   401 → token invalid, expired, or revoked server-side (password changed,
//         account deactivated). Purge local state and bounce to the right page.
//   403 + TOTP_SETUP_REQUIRED → the backend enforces authenticator enrollment,
//         so a client that skipped the UI gate gets sent back to it.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status
    const url = err.config?.url ?? ''

    if (typeof window !== 'undefined') {
      // Never redirect off the auth endpoints themselves — that would loop.
      const isAuthCall =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/forgot-password')

      if (status === 403 && err.response?.data?.errors?.code === 'TOTP_SETUP_REQUIRED') {
        if (!window.location.pathname.startsWith('/security-setup')) {
          window.location.replace('/security-setup')
        }
        return Promise.reject(err)
      }

      if (status === 401 && !isAuthCall) {
        const message: string = err.response?.data?.message ?? ''
        // An expired or revoked session is normal, not an intrusion attempt:
        // send the user to sign in again instead of the Access Denied screen.
        const expired = /expired|sign in again|no longer exists/i.test(message)

        import('@/lib/auth').then(({ purgeAllClientData }) => {
          purgeAllClientData()
          window.location.replace(expired ? '/login' : '/no-access')
        })
      }
    }

    return Promise.reject(err)
  }
)
