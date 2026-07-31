import { NextResponse } from 'next/server'
import { getState, setState } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const state = await getState()
  const storage = (!!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN) ? 'redis' : 'file'
  return NextResponse.json({ ...state, _storage: storage })
}

export async function PUT(request) {
  const body = await request.json()
  // Only persist the known top-level keys.
  const { members = [], schedule = {}, attendance = [], events = [], memos = [], version } = body || {}
  const result = await setState({ members, schedule, attendance, events, memos }, version)
  if (result.conflict) {
    return NextResponse.json(result.state, { status: 409 })
  }
  return NextResponse.json(result.state)
}
