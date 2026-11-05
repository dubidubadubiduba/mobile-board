import { NextResponse } from 'next/server'
import { getChanges } from '@/lib/store'

export const dynamic = 'force-dynamic'

// Change history, newest first: [{ at, version, changes: [...], force, ua }]
export async function GET(request) {
  const limit = Number(new URL(request.url).searchParams.get('limit')) || undefined
  return NextResponse.json(await getChanges(limit))
}
