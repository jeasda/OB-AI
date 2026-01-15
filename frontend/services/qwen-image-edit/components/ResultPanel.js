import { watermarkOverlay } from '../lib/watermark.js'

export function createResultPanel({ onDownload, onGenerateNew }) {
  const wrapper = document.createElement('div')
  wrapper.className = 'hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6'

  wrapper.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="text-xs uppercase tracking-[0.2em] text-emerald-300">ผลลัพธ์</div>
      <div id="result-frame" class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <img id="result-image" alt="result" class="w-full object-contain">
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        <button id="result-download-btn" class="rounded-xl bg-emerald-400 py-2 text-sm font-semibold text-slate-950">ดาวน์โหลด (มีลายน้ำ)</button>
        <button id="result-generate-btn" class="rounded-xl border border-slate-700 py-2 text-sm text-slate-100">เจนใหม่</button>
      </div>
    </div>
  `

  const img = wrapper.querySelector('#result-image')
  const frame = wrapper.querySelector('#result-frame')
  const downloadBtn = wrapper.querySelector('#result-download-btn')
  const generateBtn = wrapper.querySelector('#result-generate-btn')

  frame.appendChild(watermarkOverlay('OB AI Studio'))

  downloadBtn.addEventListener('click', () => onDownload())
  generateBtn.addEventListener('click', () => onGenerateNew())

  return {
    el: wrapper,
    show() {
      wrapper.classList.remove('hidden')
    },
    hide() {
      wrapper.classList.add('hidden')
    },
    setImage(src) {
      img.src = src
    }
  }
}
