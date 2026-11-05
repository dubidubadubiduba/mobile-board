// Human-readable summary of what one save changed, e.g.
//   ['점심 추가 최보미: 10/30, 11/4', '근태 추가 성수현 늦게 출근해요 10/28']
// Stored with every save so "who changed which day" can be answered later.
// Memo text is left out on purpose: memos can hold passwords.

const ATT_LABEL = {
  vacation: '휴가',
  training: '교육',
  trip: '출장',
  checkup: '건강검진',
  'early-leave': '일찍 퇴근해요',
  'late-arrive': '늦게 출근해요',
}

const md = (key) => {
  const [, m, d] = (key || '').split('-')
  return m ? `${+m}/${+d}` : key
}
const range = (x) => (x.start === x.end ? md(x.start) : `${md(x.start)}~${md(x.end)}`)

export function describeChanges(current, next) {
  const out = []
  const members = [...(next.members || []), ...(current.members || [])]
  const name = (id) => members.find((m) => m.id === id)?.name || id

  // Members
  const curM = new Map((current.members || []).map((m) => [m.id, m]))
  const nextM = new Map((next.members || []).map((m) => [m.id, m]))
  for (const [id, m] of nextM) {
    if (!curM.has(id)) out.push(`팀원 추가 ${m.name}`)
    else if (curM.get(id).name !== m.name) out.push(`팀원 이름 변경 ${curM.get(id).name} → ${m.name}`)
  }
  for (const [id, m] of curM) if (!nextM.has(id)) out.push(`팀원 삭제 ${m.name}`)

  // Lunch, grouped per member: '점심 추가 최보미: 10/30, 11/4'
  const lunch = { 추가: new Map(), 취소: new Map() }
  const days = new Set([...Object.keys(current.schedule || {}), ...Object.keys(next.schedule || {})])
  for (const day of [...days].sort()) {
    const before = current.schedule?.[day] || []
    const after = next.schedule?.[day] || []
    for (const id of after) if (!before.includes(id)) lunch.추가.set(id, [...(lunch.추가.get(id) || []), md(day)])
    for (const id of before) if (!after.includes(id)) lunch.취소.set(id, [...(lunch.취소.get(id) || []), md(day)])
  }
  for (const [verb, byMember] of Object.entries(lunch))
    for (const [id, ds] of byMember) out.push(`점심 ${verb} ${name(id)}: ${ds.join(', ')}`)

  // Attendance
  const att = (a) => `${name(a.memberId)} ${ATT_LABEL[a.type] || a.type} ${range(a)}`
  const curA = new Map((current.attendance || []).map((a) => [a.id, a]))
  const nextA = new Map((next.attendance || []).map((a) => [a.id, a]))
  for (const [id, a] of nextA) {
    if (!curA.has(id)) out.push(`근태 추가 ${att(a)}`)
    else if (att(curA.get(id)) !== att(a)) out.push(`근태 변경 ${att(curA.get(id))} → ${att(a)}`)
  }
  for (const [id, a] of curA) if (!nextA.has(id)) out.push(`근태 삭제 ${att(a)}`)

  // Events
  const ev = (e) => `${e.title} ${range(e)}`
  const curE = new Map((current.events || []).map((e) => [e.id, e]))
  const nextE = new Map((next.events || []).map((e) => [e.id, e]))
  for (const [id, e] of nextE) {
    if (!curE.has(id)) out.push(`이벤트 추가 ${ev(e)}`)
    else if (ev(curE.get(id)) !== ev(e)) out.push(`이벤트 변경 ${ev(curE.get(id))} → ${ev(e)}`)
  }
  for (const [id, e] of curE) if (!nextE.has(id)) out.push(`이벤트 삭제 ${ev(e)}`)

  // Memos (author only, never the text)
  const curMemo = new Set((current.memos || []).map((m) => m.id))
  const nextMemo = new Set((next.memos || []).map((m) => m.id))
  for (const m of next.memos || []) if (!curMemo.has(m.id)) out.push(`메모 추가 (${m.author || '익명'})`)
  for (const m of current.memos || []) if (!nextMemo.has(m.id)) out.push(`메모 삭제 (${m.author || '익명'})`)

  return out
}
