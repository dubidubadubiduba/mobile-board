'use client'

import { useEffect, useMemo, useState } from 'react'
import { PALETTE, nextColor } from '@/lib/colors'
import { WEEKDAYS, dateKey, monthGrid, monthLabel } from '@/lib/dates'
import { isRest, isWeekend, isHoliday, familyDay } from '@/lib/holidays'

const MAX_MEMBERS = 9

const ATT_TYPES = [
  { value: 'vacation', label: '휴가', icon: '🏝️' },
  { value: 'training', label: '교육', icon: '🎓' },
  { value: 'trip', label: '출장', icon: '✈️' },
]
const attLabel = (t) => ATT_TYPES.find((x) => x.value === t)?.label || t
const attIcon = (t) => ATT_TYPES.find((x) => x.value === t)?.icon || ''

function makeId() {
  return 'm' + Math.random().toString(36).slice(2, 9)
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [schedule, setSchedule] = useState({})
  const [attendance, setAttendance] = useState([])
  const [events, setEvents] = useState([])
  const [memos, setMemos] = useState([])
  const [version, setVersion] = useState(0)

  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const [selectedId, setSelectedId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('')

  // Attendance form
  const [attMember, setAttMember] = useState('')
  const [attType, setAttType] = useState('vacation')

  // Event form
  const [evTitle, setEvTitle] = useState('')
  const [evColor, setEvColor] = useState(PALETTE[0])

  // Range-picking mode — user clicks two cells to define start/end
  // { kind: 'att'|'ev', payload: {...}, start: null|'YYYY-MM-DD' }
  const [rangeMode, setRangeMode] = useState(null)

  // Memo form
  const [memoAuthor, setMemoAuthor] = useState('')
  const [memoText, setMemoText] = useState('')

  // Save state
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

  // Mobile-specific UI state
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState(null)

  // Desktop cell detail modal
  const [detailKey, setDetailKey] = useState(null)

  // ---- responsive detection ----
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // ---- load ----
  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((s) => {
        setMembers(s.members || [])
        setSchedule(s.schedule || {})
        setAttendance(s.attendance || [])
        setEvents(s.events || [])
        setMemos(s.memos || [])
        setVersion(s.version || 0)
      })
      .finally(() => setLoading(false))
  }, [])

  // ---- local state update only (no network) ----
  function update(patch) {
    if (patch.members !== undefined) setMembers(patch.members)
    if (patch.schedule !== undefined) setSchedule(patch.schedule)
    if (patch.attendance !== undefined) setAttendance(patch.attendance)
    if (patch.events !== undefined) setEvents(patch.events)
    if (patch.memos !== undefined) setMemos(patch.memos)
    setIsDirty(true)
    setSaveStatus('idle')
  }

  // ---- push a snapshot to the server, guarded by the version we last saw ----
  // If someone else saved in the meantime, the server rejects this (409)
  // instead of silently overwriting their changes.
  function pushState(next) {
    return fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...next, version }),
    }).then(async (r) => {
      if (r.status === 409) return { ok: false, conflict: true }
      if (!r.ok) return { ok: false, conflict: false }
      const saved = await r.json()
      setVersion(saved.version)
      return { ok: true }
    }).catch(() => ({ ok: false, conflict: false }))
  }

  // ---- save to server ----
  function save() {
    setSaveStatus('saving')
    pushState({ members, schedule, attendance, events, memos }).then((result) => {
      if (result.ok) {
        setSaveStatus('saved')
        setIsDirty(false)
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else if (result.conflict) {
        setSaveStatus('conflict')
      } else {
        setSaveStatus('error')
      }
    })
  }

  const memberById = useMemo(() => {
    const map = {}
    members.forEach((m) => (map[m.id] = m))
    return map
  }, [members])

  // ---- member ops ----
  function addMember() {
    const name = newName.trim()
    if (!name) return
    if (members.length >= MAX_MEMBERS) {
      alert(`팀원은 최대 ${MAX_MEMBERS}명까지 추가할 수 있어요.`)
      return
    }
    const m = { id: makeId(), name, color: newColor || nextColor(members) }
    update({ members: [...members, m] })
    setNewName('')
    setNewColor('')
  }

  function removeMember(id) {
    const m = memberById[id]
    if (!m) return
    if (!confirm(`'${m.name}' 팀원을 삭제할까요? 모든 날짜에서도 빠집니다.`)) return
    const nextSchedule = {}
    for (const [k, ids] of Object.entries(schedule)) {
      const filtered = ids.filter((x) => x !== id)
      if (filtered.length) nextSchedule[k] = filtered
    }
    if (selectedId === id) setSelectedId(null)
    if (memoAuthor === id) setMemoAuthor('')
    const nextAttendance = attendance.filter((a) => a.memberId !== id)
    update({
      members: members.filter((x) => x.id !== id),
      schedule: nextSchedule,
      attendance: nextAttendance,
    })
  }

  // ---- cell ops ----
  function addToCell(key, memberId) {
    const ids = schedule[key] || []
    if (ids.includes(memberId)) return
    if (ids.length >= MAX_MEMBERS) return
    update({ schedule: { ...schedule, [key]: [...ids, memberId] } })
  }

  function removeFromCell(key, memberId) {
    const ids = schedule[key] || []
    const filtered = ids.filter((x) => x !== memberId)
    const next = { ...schedule }
    if (filtered.length) next[key] = filtered
    else delete next[key]
    update({ schedule: next })
  }

  function toggleMemberOnDay(key, memberId) {
    const ids = schedule[key] || []
    if (ids.includes(memberId)) removeFromCell(key, memberId)
    else addToCell(key, memberId)
  }

  function onCellClick(key) {
    if (rangeMode) {
      commitRange(key)
      return
    }
    if (isMobile) {
      setSheetKey(key)
      return
    }
    if (selectedId) {
      addToCell(key, selectedId)
      return
    }
    setDetailKey(key)
  }

  // ---- attendance / event range picking ----
  function startAttPick() {
    if (!attMember) return alert('팀원을 선택하세요.')
    setSelectedId(null)
    setRangeMode({ kind: 'att', payload: { memberId: attMember, type: attType }, start: null })
  }
  function startEvPick() {
    const title = evTitle.trim()
    if (!title) return alert('이벤트 제목을 입력하세요.')
    setSelectedId(null)
    setRangeMode({ kind: 'ev', payload: { title, color: evColor }, start: null })
  }
  function cancelRange() { setRangeMode(null) }

  function commitRange(key) {
    if (!rangeMode) return
    if (!rangeMode.start) {
      setRangeMode({ ...rangeMode, start: key })
      return
    }
    const [start, end] = rangeMode.start <= key ? [rangeMode.start, key] : [key, rangeMode.start]
    if (rangeMode.kind === 'att') {
      update({ attendance: [...attendance, { id: makeId(), ...rangeMode.payload, start, end }] })
    } else {
      update({ events: [...events, { id: makeId(), ...rangeMode.payload, start, end }] })
      setEvTitle('')
    }
    setRangeMode(null)
  }

  function removeAttendance(id) {
    update({ attendance: attendance.filter((a) => a.id !== id) })
  }
  function removeEvent(id) {
    update({ events: events.filter((e) => e.id !== id) })
  }

  // ---- memo ops (auto-save immediately) ----
  function addMemo() {
    const text = memoText.trim()
    if (!text) return
    const m = memberById[memoAuthor]
    const memo = {
      id: makeId(),
      ts: new Date().toISOString(),
      author: m ? m.name : '익명',
      color: m ? m.color : '#e2e5ea',
      text,
    }
    const prevMemos = memos
    const nextMemos = [memo, ...memos].slice(0, 100)
    setMemos(nextMemos)
    setMemoText('')
    pushState({ members, schedule, attendance, events, memos: nextMemos }).then((result) => {
      if (!result.ok) {
        setMemos(prevMemos)
        if (result.conflict) alert('다른 사람이 방금 저장했어요. 새로고침 후 다시 시도해주세요.')
      }
    })
  }

  function removeMemo(id) {
    const prevMemos = memos
    const nextMemos = memos.filter((x) => x.id !== id)
    setMemos(nextMemos)
    pushState({ members, schedule, attendance, events, memos: nextMemos }).then((result) => {
      if (!result.ok) {
        setMemos(prevMemos)
        if (result.conflict) alert('다른 사람이 방금 저장했어요. 새로고침 후 다시 시도해주세요.')
      }
    })
  }

  // ---- month nav ----
  function shiftMonth(delta) {
    setView((v) => {
      const m = v.month + delta
      const year = v.year + Math.floor(m / 12)
      const month = ((m % 12) + 12) % 12
      return { year, month }
    })
  }

  const cells = monthGrid(view.year, view.month)
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const familyDayNum = familyDay(view.year, view.month)

  if (loading) return <div className="loading">불러오는 중…</div>

  // ---- save button ----
  const saveLabel =
    saveStatus === 'saving'   ? '저장 중…' :
    saveStatus === 'saved'    ? '저장됨 ✓' :
    saveStatus === 'conflict' ? '새로고침 필요 ⟳' :
    saveStatus === 'error'    ? '오류 ✕' :
    isDirty                   ? '저장하기 ●' : '저장하기'

  const saveBtn = (
    <button
      className={'btn save-btn' +
        (saveStatus === 'saved' ? ' save-ok' : '') +
        (saveStatus === 'error' ? ' save-err' : '') +
        (saveStatus === 'conflict' ? ' save-conflict' : '') +
        (!isDirty && saveStatus === 'idle' ? ' save-dim' : '')}
      onClick={saveStatus === 'conflict' ? () => window.location.reload() : save}
      disabled={saveStatus === 'saving'}
      title={saveStatus === 'conflict' ? '다른 사람이 방금 저장했어요. 눌러서 최신 내용을 불러오세요.' : undefined}
    >
      {saveLabel}
    </button>
  )

  // ---------- shared control panels ----------
  const controls = (
    <>
      <section className="panel">
        <h2>👥 팀원</h2>
        <div className="add-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
            placeholder="이름 입력"
            maxLength={10}
          />
          <button className="btn" onClick={addMember}>추가</button>
        </div>
        <div className="swatches">
          {PALETTE.map((c) => {
            const active = (newColor || nextColor(members)) === c
            return (
              <button
                key={c}
                className={'sw' + (active ? ' on' : '')}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
                title="배경색 선택"
              />
            )
          })}
        </div>
        {!isMobile && (
          <p className="hint">
            {selectedId
              ? `선택됨: ${memberById[selectedId]?.name} — 날짜 칸을 눌러 배치`
              : '팀원을 눌러 선택 → 날짜 배치 / 팀원 미선택 시 날짜 클릭 → 상세보기'}
          </p>
        )}
        {isMobile && <p className="hint">날짜를 눌러 그날 참석자를 켜고 끄세요.</p>}
        <div className="member-list">
          {members.map((m) => (
            <div className="member-row" key={m.id}>
              <button
                className={'name-btn' + (!isMobile && selectedId === m.id ? ' active' : '')}
                style={{ background: m.color }}
                onClick={() => !isMobile && setSelectedId(selectedId === m.id ? null : m.id)}
              >
                {m.name}
              </button>
              <button className="del" onClick={() => removeMember(m.id)} title="삭제">✕</button>
            </div>
          ))}
          {!members.length && <p className="empty">아직 팀원이 없어요.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>🗓️ 근태 등록</h2>
        <select value={attMember} onChange={(e) => setAttMember(e.target.value)}>
          <option value="">팀원 선택</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={attType} onChange={(e) => setAttType(e.target.value)}>
          {ATT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
        <button className="btn wide" onClick={startAttPick}>달력에서 범위 선택</button>
        <p className="hint">시작·종료 셀을 순서대로 클릭하세요.</p>
        {attendance.length > 0 && (
          <div className="mini-list">
            {attendance.map((a) => {
              const m = memberById[a.memberId]
              if (!m) return null
              return (
                <div className="mini-row" key={a.id}>
                  <span className="mini-dot" style={{ background: m.color }} />
                  <span className="mini-text">
                    {attIcon(a.type)} {m.name} · {attLabel(a.type)}
                    <br />
                    <small>{a.start} ~ {a.end}</small>
                  </span>
                  <button className="del" onClick={() => removeAttendance(a.id)} title="삭제">✕</button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>🎉 파트 이벤트</h2>
        <input
          className="wide-input"
          value={evTitle}
          onChange={(e) => setEvTitle(e.target.value)}
          placeholder="이벤트 제목 (예: 회식)"
          maxLength={20}
        />
        <div className="swatches">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={'sw' + (evColor === c ? ' on' : '')}
              style={{ background: c }}
              onClick={() => setEvColor(c)}
              title="이벤트 색"
            />
          ))}
        </div>
        <button className="btn wide" onClick={startEvPick}>달력에서 범위 선택</button>
        <p className="hint">시작·종료 셀을 순서대로 클릭하세요.</p>
        {events.length > 0 && (
          <div className="mini-list">
            {events.map((ev) => (
              <div className="mini-row" key={ev.id}>
                <span className="mini-dot" style={{ background: ev.color }} />
                <span className="mini-text">
                  {ev.title}
                  <br />
                  <small>{ev.start} ~ {ev.end}</small>
                </span>
                <button className="del" onClick={() => removeEvent(ev.id)} title="삭제">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

    </>
  )

  const rangeBanner = rangeMode && (
    <div className="range-banner">
      <span>
        {rangeMode.kind === 'att' ? '🗓️ 근태' : '🎉 이벤트'} 범위 선택:{' '}
        {rangeMode.start ? `시작 ${rangeMode.start} → 종료 셀 클릭` : '시작 셀 클릭'}
      </span>
      <button className="btn ghost" onClick={cancelRange}>취소</button>
    </div>
  )

  const calendar = (
    <>
      {rangeBanner}
      <header className="cal-header">
        <button className="nav" onClick={() => shiftMonth(-1)}>{isMobile ? '◀' : '◀ 이전달'}</button>
        <h2>{monthLabel(view.year, view.month)}</h2>
        <button className="nav" onClick={() => shiftMonth(1)}>{isMobile ? '▶' : '다음달 ▶'}</button>
      </header>

      <div className="weekhead">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={'wh' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>{w}</div>
        ))}
      </div>

      <div className="grid">
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="cell empty-cell" />
          const key = dateKey(view.year, view.month, d)
          const ids = schedule[key] || []
          const isToday = key === todayKey
          const rest = isRest(view.year, view.month, d)
          const isFamilyDay = d === familyDayNum
          const dayAttendance = attendance.filter((a) => a.start <= key && key <= a.end)
          const dayEvents = events.filter((ev) => ev.start <= key && key <= ev.end)
          return (
            <div
              key={idx}
              className={'cell' + (isToday ? ' today' : '') + (rest ? ' rest-cell' : '') +
                (!isMobile && (selectedId || rangeMode) ? ' placing' : '') +
                (rangeMode?.start === key ? ' range-start' : '')}
              onClick={() => onCellClick(key)}
            >
              <div className={'daynum' + (rest ? ' red' : '')}>{d}</div>
              {isFamilyDay && <div className="family-day-badge">Family Day</div>}
              {(dayAttendance.length > 0 || dayEvents.length > 0) && (
                <div className="bars">
                  {dayEvents.map((ev) => {
                    const isStart = ev.start === key
                    const isEnd = ev.end === key
                    return (
                      <div
                        key={ev.id}
                        className={'bar ev' + (isStart ? ' bar-start' : '') + (isEnd ? ' bar-end' : '')}
                        style={{ background: ev.color }}
                        title={`${ev.title} (${ev.start} ~ ${ev.end})`}
                      >
                        {isStart ? ev.title : ''}
                      </div>
                    )
                  })}
                  {dayAttendance.map((a) => {
                    const m = memberById[a.memberId]
                    if (!m) return null
                    const isStart = a.start === key
                    const isEnd = a.end === key
                    return (
                      <div
                        key={a.id}
                        className={'bar att' + (isStart ? ' bar-start' : '') + (isEnd ? ' bar-end' : '')}
                        style={{ background: m.color }}
                        title={`${m.name} · ${attLabel(a.type)} (${a.start} ~ ${a.end})`}
                      >
                        {isStart ? `${attIcon(a.type)} ${m.name} · ${attLabel(a.type)}` : ''}
                      </div>
                    )
                  })}
                </div>
              )}
              {isMobile ? (
                <div className="chips">
                  {ids.map((id) => {
                    const m = memberById[id]
                    if (!m) return null
                    return <span key={id} className="chip" style={{ background: m.color }}>{m.name}</span>
                  })}
                </div>
              ) : (
                <div className="chips">
                  {ids.map((id) => {
                    const m = memberById[id]
                    if (!m) return null
                    return (
                      <button
                        key={id}
                        className="chip"
                        style={{ background: m.color }}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromCell(key, id)
                        }}
                        title="눌러서 제외"
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  const memoSection = (
    <section className="memo">
      <h2>메모장</h2>
      <div className="memo-add">
        <select value={memoAuthor} onChange={(e) => setMemoAuthor(e.target.value)}>
          <option value="">익명</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMemo()}
          placeholder="한 줄 메모…"
          maxLength={80}
        />
        <button className="btn" onClick={addMemo}>등록</button>
      </div>
      <div className="memo-list">
        {memos.length === 0 && <p className="empty">아직 메모가 없어요.</p>}
        {memos.map((m) => (
          <div className="memo-row" key={m.id}>
            <span className="memo-author" style={{ background: m.color }}>{m.author}</span>
            <span className="memo-text">{m.text}</span>
            <span className="memo-time">{formatTime(m.ts)}</span>
            <button className="memo-del" onClick={() => removeMemo(m.id)} title="삭제">✕</button>
          </div>
        ))}
      </div>
    </section>
  )

  // ---------- Mobile layout ----------
  if (isMobile) {
    const sheetIds = sheetKey ? schedule[sheetKey] || [] : []
    return (
      <div className="m-layout">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="메뉴">☰</button>
          <span className="topbar-title">Mobile Board</span>
          <span className="topbar-spacer" />
          {saveBtn}
        </header>

        <main className="m-main">
          {calendar}
          {memoSection}
        </main>

        {drawerOpen && (
          <div className="overlay" onClick={() => setDrawerOpen(false)}>
            <aside className="drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-head">
                <h1 className="brand">Mobile Board</h1>
                <button className="close" onClick={() => setDrawerOpen(false)}>✕</button>
              </div>
              {controls}
            </aside>
          </div>
        )}

        {sheetKey && (
          <div className="overlay bottom" onClick={() => setSheetKey(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <strong>{sheetKey} 참석자</strong>
                <button className="close" onClick={() => setSheetKey(null)}>완료</button>
              </div>
              {!members.length && <p className="empty">먼저 ☰ 메뉴에서 팀원을 추가하세요.</p>}
              <div className="sheet-list">
                {members.map((m) => {
                  const on = sheetIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      className={'sheet-item' + (on ? ' on' : '')}
                      style={{ background: m.color }}
                      onClick={() => toggleMemberOnDay(sheetKey, m.id)}
                    >
                      <span>{m.name}</span>
                      <span className="check">{on ? '✓' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- Desktop layout ----------
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">Mobile Board</h1>
        {controls}
      </aside>
      <main className="main">
        <div className="main-topbar">
          {saveBtn}
        </div>
        {calendar}
        {memoSection}
      </main>
      {detailKey && (() => {
        const ids = schedule[detailKey] || []
        const dayAtt = attendance.filter((a) => a.start <= detailKey && detailKey <= a.end)
        const dayEv = events.filter((ev) => ev.start <= detailKey && detailKey <= ev.end)
        return (
          <div className="overlay" onClick={() => setDetailKey(null)}>
            <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="detail-head">
                <strong>{detailKey}</strong>
                <button className="close" onClick={() => setDetailKey(null)}>닫기</button>
              </div>

              <div className="detail-section">
                <h3>🎉 이벤트</h3>
                {dayEv.length === 0 && <p className="empty">없음</p>}
                {dayEv.map((ev) => (
                  <div className="detail-row" key={ev.id}>
                    <span className="mini-dot" style={{ background: ev.color }} />
                    <span>{ev.title}</span>
                    <small>{ev.start} ~ {ev.end}</small>
                  </div>
                ))}
              </div>

              <div className="detail-section">
                <h3>🗓️ 근태</h3>
                {dayAtt.length === 0 && <p className="empty">없음</p>}
                {dayAtt.map((a) => {
                  const m = memberById[a.memberId]
                  if (!m) return null
                  return (
                    <div className="detail-row" key={a.id}>
                      <span className="mini-dot" style={{ background: m.color }} />
                      <span>{attIcon(a.type)} {m.name} · {attLabel(a.type)}</span>
                      <small>{a.start} ~ {a.end}</small>
                    </div>
                  )
                })}
              </div>

              <div className="detail-section">
                <h3>🍚 점심</h3>
                {ids.length === 0 && <p className="empty">없음</p>}
                <div className="detail-chips">
                  {ids.map((id) => {
                    const m = memberById[id]
                    if (!m) return null
                    return (
                      <button
                        key={id}
                        className="chip"
                        style={{ background: m.color }}
                        onClick={() => removeFromCell(detailKey, id)}
                        title="눌러서 제외"
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function formatTime(ts) {
  try {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${mi}`
  } catch {
    return ''
  }
}
