export function createOptionSelect({ id, label, options, value, onChange }) {
  const wrapper = document.createElement('div')
  wrapper.className = 'field'

  const labelEl = document.createElement('label')
  labelEl.className = 'field-label'
  labelEl.setAttribute('for', id)
  labelEl.textContent = label

  const select = document.createElement('select')
  select.className = 'select'
  select.id = id

  for (const option of options) {
    const opt = document.createElement('option')
    opt.value = option.value
    opt.textContent = option.label
    select.appendChild(opt)
  }

  if (value) select.value = value

  select.addEventListener('change', () => {
    onChange(select.value)
  })

  wrapper.appendChild(labelEl)
  wrapper.appendChild(select)

  return {
    el: wrapper,
    setValue(next) {
      select.value = next
    },
    getValue() {
      return select.value
    }
  }
}
