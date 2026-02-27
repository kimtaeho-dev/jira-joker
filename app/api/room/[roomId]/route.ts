import { NextResponse } from 'next/server'

import { roomExists } from '@/lib/signalingStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  return NextResponse.json({ exists: roomExists(roomId) })
}
