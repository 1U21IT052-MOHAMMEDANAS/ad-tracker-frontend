export const AD_STATUSES = ['active', 'paused', 'completed', 'draft']

export function money(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—'
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`
  }
}

export function num(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('en-IN').format(value)
}

export function date(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
