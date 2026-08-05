// 27 background colors, grouped into three visual rows.
export const PALETTE = [
  // Row 1 — pastel
  '#F8B4B4', '#FBD38D', '#FAF089', '#9AE6B4', '#81E6D9',
  '#90CDF4', '#A3BFFA', '#D6BCFA', '#FBB6CE',
  // Row 2 — vivid
  '#FF1A1A', '#FF8C1A', '#FFD91A', '#1AFF66', '#1AFFC9',
  '#1A98FF', '#5C77FF', '#A64CFF', '#FF1A8C',
  // Row 3 — neutrals: 4 grays, 4 browns, 1 elegant near-black
  '#E5E7EB', '#9CA3AF', '#6B7280', '#374151',
  '#E8D5B7', '#B08968', '#8B5E3C', '#5C3A21',
  '#1C1917',
]

// Pick the first palette color not already used by an existing member.
export function nextColor(members) {
  const used = new Set(members.map((m) => m.color))
  return PALETTE.find((c) => !used.has(c)) || PALETTE[members.length % PALETTE.length]
}

// Choose black or white text depending on background luminance.
export function readableTextColor(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Rec. 601 luma
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.6 ? '#000' : '#fff'
}
