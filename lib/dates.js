export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// Zero-padded 'YYYY-MM-DD' for a given year/month(0-11)/day.
export function dateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// Build a 6-row calendar grid (42 cells). Cells outside the month are null.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function monthLabel(year, month) {
  return `${year}년 ${month + 1}월`
}

// ISO 8601 week number (weeks start Monday; week containing Jan 4 is W01).
export function isoWeek(year, month, day) {
  const d = new Date(Date.UTC(year, month, day))
  const dayNum = d.getUTCDay() || 7 // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // move to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}
