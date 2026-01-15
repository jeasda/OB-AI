const ratioMap = {
  square: { width: 1024, height: 1024 },
  landscape: { width: 1024, height: 576 },
  portrait: { width: 576, height: 1024 }
}

export function ratioToSize(ratio) {
  return ratioMap[ratio] || ratioMap.square
}

export function ratioLabelToValue(label) {
  if (label === 'Square') return 'square'
  if (label === 'Landscape') return 'landscape'
  if (label === 'Portrait') return 'portrait'
  return 'square'
}
