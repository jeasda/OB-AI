const RATIOS = [
  { id: 'square', label: 'Square' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'portrait', label: 'Portrait' }
]

export function createRatioSelect({ value, onChange }) {
  const wrapper = document.createElement('div')
  wrapper.className = 'space-y-2'

  const labelEl = document.createElement('div')
  labelEl.className = 'text-xs font-semibold text-slate-200'
  labelEl.textContent = 'สัดส่วนภาพ'

  const buttonRow = document.createElement('div')
  buttonRow.className = 'grid gap-2'

  const buttons = new Map()

  for (const ratio of RATIOS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'rounded-xl border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-emerald-400'
    button.textContent = ratio.label
    button.dataset.value = ratio.id
    button.addEventListener('click', () => {
      onChange(ratio.id)
    })
    buttons.set(ratio.id, button)
    buttonRow.appendChild(button)
  }

  function setValue(next) {
    for (const [ratio, button] of buttons.entries()) {
      if (ratio === next) {
        button.classList.add('border-emerald-400', 'bg-emerald-400/10')
      } else {
        button.classList.remove('border-emerald-400', 'bg-emerald-400/10')
      }
    }
  }

  setValue(value)

  wrapper.appendChild(labelEl)
  wrapper.appendChild(buttonRow)

  return {
    el: wrapper,
    setValue
  }
}
