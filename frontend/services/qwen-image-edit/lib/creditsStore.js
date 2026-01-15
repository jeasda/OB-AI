const KEY = 'obai_credits'

export function getCredits() {
  const raw = localStorage.getItem(KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export function setCredits(value) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  localStorage.setItem(KEY, String(safe))
  return safe
}

export function addCredits(amount) {
  const current = getCredits()
  return setCredits(current + amount)
}

export function spendCredits(amount) {
  const current = getCredits()
  if (current < amount) return false
  setCredits(current - amount)
  return true
}
