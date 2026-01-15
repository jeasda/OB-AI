import { watermarkOverlay } from '../lib/watermark.js'

export function createResultPanel({ onDownload, onGenerateNew }) {
  const wrapper = document.createElement('div')
  wrapper.className = 'panel hidden'

  wrapper.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="panel-title">ผลลัพธ์</div>
      <div id="result-frame" class="result-frame">
        <img id="result-image" alt="result" class="result-image">
      </div>
      <div class="panel-section" style="flex-direction:row; gap:12px;">
        <button id="result-download-btn" class="btn btn-primary">ดาวน์โหลด (มีลายน้ำ)</button>
        <button id="result-generate-btn" class="btn btn-secondary">เจนใหม่</button>
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
