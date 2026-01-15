export const catalogs = {
  clothes: [
    { id: 'no_change', label: 'ไม่เปลี่ยน' },
    { id: 'teen', label: 'ชุดวัยรุ่น' },
    { id: 'evening_gown', label: 'ชุดราตรีงานเลี้ยง' },
    { id: 'sleepwear', label: 'ชุดนอน' },
    { id: 'travel', label: 'ชุดไปเที่ยว' },
    { id: 'luxury', label: 'ชุดไฮโซ' },
    { id: 'thai', label: 'ชุดไทย' },
    { id: 'office', label: 'ชุดทำงานออฟฟิศ' }
  ],
  location: [
    { id: 'no_change', label: 'ไม่เปลี่ยน' },
    { id: 'cafe', label: 'คาเฟ่' },
    { id: 'beach', label: 'ทะเล' },
    { id: 'misty_mountain', label: 'ภูเขาทะเลหมอก' },
    { id: 'domestic', label: 'ต่างจังหวัด', sub: ['Chiang Mai', 'Phuket', 'Ayutthaya'] },
    { id: 'international', label: 'ต่างประเทศ', sub: ['London', 'Paris', 'Shanghai', 'Fuji'] }
  ],
  activity: [
    { id: 'unspecified', label: 'ไม่ระบุ' },
    { id: 'pose', label: 'โพสท่าสวยๆ', sub: ['ยืนธรรมชาติ', 'โพสนางแบบ', 'แคนดิดไม่มองกล้อง', 'นั่งโพส'] },
    { id: 'walk', label: 'เดินท่องเที่ยว' },
    { id: 'coffee', label: 'จิบกาแฟ' },
    { id: 'backpack', label: 'แบกเป้เดินทาง' }
  ],
  mood: [
    { id: 'modeling', label: 'ถ่ายแบบ' },
    { id: 'sad', label: 'เศร้า' },
    { id: 'neutral', label: 'หน้าเรียบเฉย' },
    { id: 'soft_smile', label: 'ยิ้มน้อยๆ' },
    { id: 'happy', label: 'ดีใจ' },
    { id: 'gaze', label: 'เหม่อมอง' }
  ],
  ratio: [
    { id: 'square', label: 'Square', size: { width: 1024, height: 1024 } },
    { id: 'landscape', label: 'Landscape', size: { width: 1024, height: 576 } },
    { id: 'portrait', label: 'Portrait', size: { width: 576, height: 1024 } }
  ]
}

const mapping = {
  clothes: {
    'ไม่เปลี่ยน': null,
    'ชุดวัยรุ่น': 'เปลี่ยนชุดเป็นชุดวัยรุ่น',
    'ชุดราตรีงานเลี้ยง': 'เปลี่ยนชุดเป็นชุดราตรีงานเลี้ยง',
    'ชุดนอน': 'เปลี่ยนชุดเป็นชุดนอน',
    'ชุดไปเที่ยว': 'เปลี่ยนชุดเป็นชุดไปเที่ยว',
    'ชุดไฮโซ': 'เปลี่ยนชุดเป็นชุดไฮโซ',
    'ชุดไทย': 'เปลี่ยนชุดเป็นชุดไทย',
    'ชุดทำงานออฟฟิศ': 'เปลี่ยนชุดเป็นชุดทำงานออฟฟิศ'
  },
  location: {
    'ไม่เปลี่ยน': null,
    'คาเฟ่': 'เปลี่ยนฉากหลังเป็นคาเฟ่ แสงและสีเข้ากัน',
    'ทะเล': 'เปลี่ยนฉากหลังเป็นทะเล แสงและสีเข้ากัน',
    'ภูเขาทะเลหมอก': 'เปลี่ยนฉากหลังเป็นภูเขาทะเลหมอก แสงและสีเข้ากัน',
    'ต่างจังหวัด': 'เปลี่ยนฉากหลังเป็นบรรยากาศต่างจังหวัด แสงและสีเข้ากัน',
    'ต่างประเทศ': 'เปลี่ยนฉากหลังเป็นบรรยากาศต่างประเทศ แสงและสีเข้ากัน'
  },
  locationSub: {
    'Chiang Mai': 'บรรยากาศเชียงใหม่',
    'Phuket': 'บรรยากาศภูเก็ต',
    'Ayutthaya': 'บรรยากาศอยุธยา',
    'London': 'บรรยากาศลอนดอน',
    'Paris': 'บรรยากาศปารีส',
    'Shanghai': 'บรรยากาศเซี่ยงไฮ้',
    'Fuji': 'บรรยากาศฟูจิ'
  },
  activity: {
    'ไม่ระบุ': null,
    'โพสท่าสวยๆ': 'ท่าทางโพสสวยๆ ดูเป็นธรรมชาติ',
    'เดินท่องเที่ยว': 'ท่าทางกำลังเดินท่องเที่ยว',
    'จิบกาแฟ': 'ท่าทางกำลังจิบกาแฟ',
    'แบกเป้เดินทาง': 'ท่าทางแบกเป้เดินทาง'
  },
  activitySub: {
    'ยืนธรรมชาติ': 'ยืนธรรมชาติ',
    'โพสนางแบบ': 'โพสนางแบบ',
    'แคนดิดไม่มองกล้อง': 'แคนดิดไม่มองกล้อง',
    'นั่งโพส': 'นั่งโพส'
  },
  mood: {
    'ถ่ายแบบ': 'อารมณ์สีหน้าแบบถ่ายแบบ',
    'เศร้า': 'อารมณ์สีหน้าเศร้า',
    'หน้าเรียบเฉย': 'อารมณ์สีหน้าเรียบเฉย',
    'ยิ้มน้อยๆ': 'อารมณ์สีหน้ายิ้มน้อยๆ',
    'ดีใจ': 'อารมณ์สีหน้าดีใจ',
    'เหม่อมอง': 'อารมณ์สีหน้าเหม่อมอง'
  }
}

function findRatioSize(labelOrId) {
  const match = catalogs.ratio.find((ratio) => ratio.label === labelOrId || ratio.id === labelOrId)
  return match ? match.size : catalogs.ratio[0].size
}

function addTag(tags, category, value) {
  if (!value) return
  tags.push(`${category}:${value}`)
}

export function buildPromptV1(selection, locale = 'th') {
  const safeSelection = selection || {}
  const promptParts = []
  const tags = []

  const base = 'ปรับภาพนี้ให้สมจริง คมชัด โทนสวย เป็นธรรมชาติ โดยคงหน้า ทรงผม อายุ และตัวตนเดิม'
  const safety = 'รายละเอียดผิวเป็นธรรมชาติ ไม่เป็นพลาสติก ไม่เป็นตุ๊กตา'

  promptParts.push(base)

  const clothesClause = mapping.clothes[safeSelection.clothes]
  const locationClause = mapping.location[safeSelection.location]
  const locationSubClause = mapping.locationSub[safeSelection.locationSub]
  const activityClause = mapping.activity[safeSelection.activity]
  const activitySubClause = mapping.activitySub[safeSelection.activitySub]
  const moodClause = mapping.mood[safeSelection.mood]

  if (clothesClause) promptParts.push(clothesClause)
  if (locationClause) promptParts.push(locationClause)
  if (locationSubClause) promptParts.push(locationSubClause)
  if (activityClause) promptParts.push(activityClause)
  if (activitySubClause) promptParts.push(activitySubClause)
  if (moodClause) promptParts.push(moodClause)

  promptParts.push(safety)

  addTag(tags, 'clothes', safeSelection.clothes)
  addTag(tags, 'location', safeSelection.location)
  addTag(tags, 'location_sub', safeSelection.locationSub)
  addTag(tags, 'activity', safeSelection.activity)
  addTag(tags, 'activity_sub', safeSelection.activitySub)
  addTag(tags, 'mood', safeSelection.mood)
  addTag(tags, 'aspect', safeSelection.ratioDisplay || safeSelection.ratio)

  const ratioLabel = safeSelection.ratioDisplay || safeSelection.ratio || 'Square'
  const size = findRatioSize(ratioLabel)

  const negativePrompt = 'มือผิดรูป นิ้วเกิน หน้าบิดเบี้ยว ผิวพลาสติก ตุ๊กตา'

  return {
    prompt: promptParts.join(' '),
    negativePrompt,
    tags,
    seedHint: null,
    ratio: safeSelection.ratio || null,
    ratioLabel,
    size
  }
}

export const promptMappingTable = mapping
