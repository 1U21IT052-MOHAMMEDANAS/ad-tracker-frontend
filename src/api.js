import axios from 'axios'

// In dev, Vite proxies /api to Laravel. For production set VITE_API_URL (e.g. https://example.com/api).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json' },
})

/** Turn an axios error into a readable message (Laravel validation aware). */
export function errorMessage(err) {
  const data = err?.response?.data
  if (data?.errors) return Object.values(data.errors).flat().join(' ')
  return data?.message || err?.message || 'Something went wrong'
}

export default api
