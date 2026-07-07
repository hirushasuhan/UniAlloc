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

// Global 401 → redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('ua_token')
      sessionStorage.removeItem('ua_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
