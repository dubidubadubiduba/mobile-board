# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # Next.js dev server (Turbopack). On android/arm64 (Termux), use: npx next dev --webpack
npm run build
npm run start
npm run lint
```

There are no tests. `package.json` name is still `mealfriend` (pre-rebrand) — this is unrelated to the user-facing brand `Mobile Board`.

## Architecture

**Single-page Next.js App Router app.** All UI lives in `app/page.js` (~700 lines). There is no component tree — both mobile (bottom-sheet) and desktop (left-sidebar) layouts are two branches inside one client component, chosen by a `matchMedia('(max-width: 760px)')` hook.

### Data model (single JSON blob)

```js
{
  members:    [{ id, name, color }],                              // max 9
  schedule:   { 'YYYY-MM-DD': [memberId, ...] },                  // lunch attendees per day
  attendance: [{ id, memberId, type, start, end }],               // type: 'vacation'|'training'|'trip'
  events:     [{ id, title, color, start, end }],                 // part events (회식 etc.)
  memos:      [{ id, ts, author, color, text }],                  // capped at 100
  version:    number                                              // bumped on every write
}
```

All collections share one document, read/written via `GET`/`PUT /api/state`. `attendance` and `events` are date **ranges** rendered as multi-day bars — they are not exploded per-day in storage.

### State persistence flow

1. `lib/store.js` picks backend by env: Upstash Redis (`UPSTASH_REDIS_REST_URL` + `..._TOKEN`) in prod, local `/tmp/mealfriend-state.json` fallback.
2. `getState()` merges with `DEFAULT_STATE` (`{ ...DEFAULT_STATE, ...state }`) — **new top-level fields are automatically injected into old documents**, so schema additions are backward compatible without migration.
3. Client `update(patch)` sets local state + `isDirty=true`. User must click Save (top-right button) which calls `pushState()` → `PUT /api/state` with the client's last-known `version`.
4. **Memo add/delete bypasses the save button** and calls `pushState()` immediately (with client-side rollback on failure).
5. **Optimistic concurrency**: server rejects with 409 if `expectedVersion` doesn't match current — client shows `새로고침 필요` instead of overwriting. Any change to `setState` calls in the API route must preserve this pattern.

### Cross-collection invariants

- `removeMember()` cascades: filters `schedule` entries and `attendance` items referencing that member. `events` are not tied to members, so no cascade.
- `MAX_MEMBERS = 9` is enforced in add/place operations (3×3 grid assumption).
- All cell rendering iterates `attendance` / `events` and filters by `start <= key && key <= end` — no precomputed index.

### Calendar helpers

- `lib/holidays.js` — Korean holidays (fixed + variable per year), plus `familyDay(year, month)` which is a **hard-coded map** (not computed). New years must be added manually.
- `lib/dates.js` — month grid + date-key formatting.
- `lib/colors.js` — palette + `nextColor(members)` for auto-assigning new member colors.

### Mobile vs. desktop UI

- **Desktop**: sidebar with all controls; clicking a member selects them, then clicking a cell places them. Clicking a cell **without a selected member** opens a detail modal (`detailKey` state) listing that day's events + attendance + lunch.
- **Mobile**: hamburger drawer for controls; tapping a cell opens a bottom sheet with per-member toggles. The detail modal is desktop-only — mobile shows the same info via the toggle sheet.
