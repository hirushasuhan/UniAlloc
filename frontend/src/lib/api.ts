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

// Global 401 (invalid/expired/tampered token) → purge everything & show Access Denied
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      // Avoid a redirect loop when the login attempt itself returns 401
      const isLoginCall = err.config?.url?.includes('/auth/login')
      if (!isLoginCall) {
        import('@/lib/auth').then(({ purgeAllClientData }) => {
          purgeAllClientData()
          window.location.replace('/no-access')
        })
      }
    }
    return Promise.reject(err)
  }
)
