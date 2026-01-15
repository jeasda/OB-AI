export function createProgressPanel() {
  const wrapper = document.createElement('div')
  wrapper.className = 'panel hidden'

  wrapper.innerHTML = `
    <div class="panel-section">
      <div class="panel-title">กำลังประมวลผล</div>
      <div id="progress-title" style="font-size:18px;font-weight:600;">เตรียมภาพ</div>
      <div class="muted">ใช้เวลาเล็กน้อย</div>
    </div>
    <div class="progress-bar">
      <div id="progress-bar" class="progress-fill"></div>
    </div>
    <div class="panel-section" style="gap:8px;">
      <div id="step-1" class="muted">เตรียมภาพ - กำลังทำ</div>
      <div id="step-2" class="muted">ประมวลผล - รอคิว</div>
      <div id="step-3" class="muted">เก็บรายละเอียด - รอคิว</div>
    </div>
    <div id="progress-note" class="muted"></div>
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
      if (idx < activeIndex) {
        step.textContent = `${step.textContent.split(' - ')[0]} - เสร็จแล้ว`
      } else if (idx === activeIndex) {
        step.textContent = `${step.textContent.split(' - ')[0]} - กำลังทำ`
      } else {
        step.textContent = `${step.textContent.split(' - ')[0]} - รอคิว`
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
