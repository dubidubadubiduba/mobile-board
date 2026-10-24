// Three-way merge used when a save is rejected (409) because someone else saved
// first. `base` is the server state this client last loaded/saved, `local` is
// what the user has now, `server` is the latest stored state. Only what the user
// changed since `base` is re-applied on top of `server`, so neither side's edits
// are thrown away.

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Arrays of { id, ... } objects (members, attendance, events).
function mergeById(base, local, server) {
  const baseById = new Map(base.map((x) => [x.id, x]))
  const localById = new Map(local.map((x) => [x.id, x]))
  const removed = new Set(base.filter((x) => !localById.has(x.id)).map((x) => x.id))
  const merged = server
    .filter((x) => !removed.has(x.id))
    .map((x) => {
      const l = localById.get(x.id)
      const b = baseById.get(x.id)
      return l && b && !sameJson(l, b) ? l : x
    })
  const have = new Set(merged.map((x) => x.id))
  for (const x of local) if (!baseById.has(x.id) && !have.has(x.id)) merged.push(x)
  return merged
}

// { 'YYYY-MM-DD': [memberId, ...] } — merged per day, per member.
function mergeSchedule(base, local, server) {
  const out = { ...server }
  const days = new Set([...Object.keys(base), ...Object.keys(local)])
  for (const day of days) {
    const b = base[day] || []
    const l = local[day] || []
    const added = l.filter((id) => !b.includes(id))
    const removed = b.filter((id) => !l.includes(id))
    if (!added.length && !removed.length) continue
    const s = server[day] || []
    const next = [...s.filter((id) => !removed.includes(id)), ...added.filter((id) => !s.includes(id))]
    if (next.length) out[day] = next
    else delete out[day]
  }
  return out
}

export function mergeState(base, local, server) {
  return {
    members: mergeById(base.members || [], local.members || [], server.members || []),
    attendance: mergeById(base.attendance || [], local.attendance || [], server.attendance || []),
    events: mergeById(base.events || [], local.events || [], server.events || []),
    schedule: mergeSchedule(base.schedule || {}, local.schedule || {}, server.schedule || {}),
    // Memos save immediately, so the server's copy is always the newest.
    memos: server.memos || [],
  }
}
