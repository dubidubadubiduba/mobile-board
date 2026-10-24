// Shared state store.
// In production it uses Upstash Redis. When env vars are absent
// (e.g. local `next dev`) it falls back to a JSON file under /tmp.

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

const STATE_KEY = 'mealfriend:state'

const DEFAULT_STATE = {
  members: [], // [{ id, name, color }]
  schedule: {}, // { 'YYYY-MM-DD': [memberId, ...] }
  attendance: [], // [{ id, memberId, type: 'training'|'vacation'|'trip', start, end }]  (YYYY-MM-DD inclusive)
  events: [], // [{ id, title, color, start, end }]
  memos: [], // [{ id, ts, author, color, text }]
  version: 0, // bumped on every save; used to detect concurrent overwrites
}

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

// ---- Upstash Redis backend ----
async function redisGet() {
  const { Redis } = await import('@upstash/redis')
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  const state = await redis.get(STATE_KEY)
  return state || DEFAULT_STATE
}

async function redisSet(state) {
  const { Redis } = await import('@upstash/redis')
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  await redis.set(STATE_KEY, state)
}

const BACKUP_KEY = 'mealfriend:backups'
const BACKUP_KEEP = 50

// Push the state about to be replaced onto a capped list (newest first),
// tagged with when/who replaced it so a bad overwrite can be traced.
async function redisBackup(state, meta) {
  const { Redis } = await import('@upstash/redis')
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  await redis.lpush(BACKUP_KEY, JSON.stringify({ replacedAt: new Date().toISOString(), ...meta, state }))
  await redis.ltrim(BACKUP_KEY, 0, BACKUP_KEEP - 1)
}

// A single save may not silently drop more than this many items. Deleting a
// member legitimately cascades away their entries, so those don't count.
const MAX_REMOVED = { schedule: 10, attendance: 5, events: 5 }

// Count what `next` would remove from `current`, ignoring entries that belong
// to members that `next` also removes.
export function countRemoved(current, next) {
  const keptMembers = new Set((next.members || []).map((m) => m.id))
  const gone = (id) => !keptMembers.has(id)
  let schedule = 0
  for (const [day, ids] of Object.entries(current.schedule || {})) {
    const after = next.schedule?.[day] || []
    schedule += ids.filter((id) => !after.includes(id) && !gone(id)).length
  }
  const nextAtt = new Set((next.attendance || []).map((a) => a.id))
  const attendance = (current.attendance || []).filter((a) => !nextAtt.has(a.id) && !gone(a.memberId)).length
  const nextEv = new Set((next.events || []).map((e) => e.id))
  const events = (current.events || []).filter((e) => !nextEv.has(e.id)).length
  return { schedule, attendance, events }
}

// ---- Local file fallback ----
const FILE = path.join(os.tmpdir(), 'mealfriend-state.json')

async function fileGet() {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return DEFAULT_STATE
  }
}

async function fileSet(state) {
  await fs.writeFile(FILE, JSON.stringify(state), 'utf8')
}

export async function getState() {
  const state = hasRedis ? await redisGet() : await fileGet()
  // Ensure shape is complete even if an older/partial doc was stored.
  return { ...DEFAULT_STATE, ...state }
}

// Optimistic concurrency: caller must pass the version it last read.
// If the stored version has since moved on (someone else saved first),
// the write is rejected instead of silently overwriting their changes.
//
// A save that would drop many entries at once is refused unless `force` is set
// (the client asks the user first): in Oct 2026 one save replaced the whole
// document with an old copy and wiped three weeks of lunches.
export async function setState(patch, expectedVersion, { force = false, ua = '' } = {}) {
  const current = await getState()
  const removed = countRemoved(current, patch)
  const log = (result) =>
    console.log(JSON.stringify({ event: 'save', result, from: current.version, expectedVersion, force, removed, ua }))
  if (typeof expectedVersion === 'number' && expectedVersion !== current.version) {
    log('conflict')
    return { conflict: true, state: current }
  }
  const tooMany = Object.keys(MAX_REMOVED).some((k) => removed[k] > MAX_REMOVED[k])
  if (tooMany && !force) {
    log('blocked')
    return { blocked: true, removed }
  }
  const next = { ...patch, version: current.version + 1 }
  // Keep the last saves so a bad overwrite can be rolled back by hand. Best
  // effort: a backup failure must never block the real save.
  if (hasRedis) await redisBackup(current, { byVersion: next.version, removed, force, ua }).catch(() => {})
  if (hasRedis) await redisSet(next)
  else await fileSet(next)
  log('saved')
  return { conflict: false, state: next }
}
