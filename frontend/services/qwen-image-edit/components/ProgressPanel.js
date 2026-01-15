export function createProgressPanel() {
  const wrapper = document.createElement('div')
  wrapper.className = 'hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6'

  wrapper.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <div class="text-xs uppercase tracking-[0.2em] text-slate-400">สถานะกำลังทำงาน</div>
        <div id="progress-title" class="text-lg font-semibold">เตรียมภาพ</div>
      </div>
      <div class="text-xs text-slate-400">ใช้เวลาเล็กน้อย</div>
    </div>
    <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div id="progress-bar" class="h-full w-0 rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-300" style="animation: shimmer 2s linear infinite;"></div>
    </div>
    <div class="mt-4 grid gap-2 text-sm text-slate-300">
      <div id="step-1" class="flex items-center justify-between"><span>เตรียมภาพ</span><span class="text-xs text-emerald-300">กำลังทำ</span></div>
      <div id="step-2" class="flex items-center justify-between"><span>ประมวลผล</span><span class="text-xs text-slate-500">รอคิว</span></div>
      <div id="step-3" class="flex items-center justify-between"><span>เก็บรายละเอียด</span><span class="text-xs text-slate-500">รอคิว</span></div>
    </div>
    <div id="progress-note" class="mt-3 text-xs text-slate-500"></div>
  `

  const title = wrapper.querySelector('#progress-title')
  const bar = wrapper.querySelector('#progress-bar')
  const note = wrapper.querySelector('#progress-note')
  const step1 = wrapper.querySelector('#step-1')
  const step2 = wrapper.querySelector('#step-2')
  const step3 = wrapper.querySelector('#step-3')

  function setStep(activeIndex) {
    const steps = [step1, step2, step3]
    steps.forEach((step, idx) => {
      const badge = step.querySelector('span:last-child')
      if (idx < activeIndex) {
        badge.textContent = 'เสร็จแล้ว'
        badge.className = 'text-xs text-emerald-300'
      } else if (idx === activeIndex) {
        badge.textContent = 'กำลังทำ'
        badge.className = 'text-xs text-emerald-300'
      } else {
        badge.textContent = 'รอคิว'
        badge.className = 'text-xs text-slate-500'
      }
    })
  }

  return {
    el: wrapper,
    show() {
      wrapper.classList.remove('hidden')
    },
    hide() {
      wrapper.classList.add('hidden')
    },
    setProgress(value) {
      bar.style.width = `${value}%`
    },
    setTitle(text) {
      title.textContent = text
    },
    setNote(text) {
      note.textContent = text
    },
    setStep
  }
}
