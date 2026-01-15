export function watermarkOverlay(text) {
  const overlay = document.createElement('div')
  overlay.className = 'absolute inset-0 flex items-end justify-end bg-gradient-to-t from-slate-950/50 via-transparent to-transparent'

  const badge = document.createElement('div')
  badge.className = 'm-4 rounded-full bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200'
  badge.textContent = text

  overlay.appendChild(badge)
  return overlay
}
