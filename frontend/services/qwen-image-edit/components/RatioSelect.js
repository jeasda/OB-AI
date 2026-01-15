const RATIOS = [
  { id: 'square', label: 'Square' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'portrait', label: 'Portrait' }
]

export function createRatioSelect({ value, onChange }) {
  const wrapper = document.createElement('div')
  wrapper.className = 'field'

  const labelEl = document.createElement('div')
  labelEl.className = 'field-label'
  labelEl.textContent = 'สัดส่วนภาพ'

  const buttonRow = document.createElement('div')
  buttonRow.className = 'ratio-grid'

  const buttons = new Map()

  for (const ratio of RATIOS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ratio-button'
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
        button.classList.add('is-active')
      } else {
        button.classList.remove('is-active')
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
