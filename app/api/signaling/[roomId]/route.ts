import { NextRequest } from 'next/server'

import {
  addPeer,
  broadcast,
  getExistingPeers,
  removePeer,
  sendToPeer,
} from '@/lib/signalingStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const { searchParams } = request.nextUrl
  const peerId = searchParams.get('peerId')
  const name = searchParams.get('name')

  if (!peerId || !name) {
    return new Response('Missing peerId or name', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addPeer(roomId, peerId, name, controller, encoder)

      // 신규 피어에게 기존 피어 목록 전달
      const existingPeers = getExistingPeers(roomId).filter((p) => p.id !== peerId)
      const roomStateChunk = encoder.encode(
        `event: room_state\ndata: ${JSON.stringify({ peers: existingPeers })}\n\n`,
      )
      controller.enqueue(roomStateChunk)

      // 기존 피어들에게 신규 피어 알림
      broadcast(roomId, peerId, 'peer_joined', { peerId, name })

      // 15초 heartbeat (dead connection 빠른 감지)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 15_000)

      // 연결 종료 감지
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        const removed = removePeer(roomId, peerId)
        if (removed) {
          broadcast(roomId, peerId, 'peer_left', { peerId })
        }
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const body = await request.json() as {
    from: string
    to?: string
    type: string
    payload: unknown
  }

  const { from, to, type, payload } = body

  if (type === 'leave') {
    const removed = removePeer(roomId, from)
    if (removed) {
      broadcast(roomId, from, 'peer_left', { peerId: from })
    }
    return new Response(null, { status: 204 })
  }

  if (to) {
    sendToPeer(roomId, to, type, { from, ...( payload as object) })
  } else {
    broadcast(roomId, from, type, { from, ...(payload as object) })
  }

  return new Response(null, { status: 204 })
}
