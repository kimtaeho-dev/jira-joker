interface PeerEntry {
  name: string
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
}

// roomId → peerId → PeerEntry
const rooms = new Map<string, Map<string, PeerEntry>>()

function getRoom(roomId: string): Map<string, PeerEntry> {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map())
  return rooms.get(roomId)!
}

export function addPeer(
  roomId: string,
  peerId: string,
  name: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): void {
  getRoom(roomId).set(peerId, { name, controller, encoder })
}

export function removePeer(roomId: string, peerId: string): void {
  const room = rooms.get(roomId)
  if (!room) return
  room.delete(peerId)
  if (room.size === 0) rooms.delete(roomId)
}

export function sendToPeer(
  roomId: string,
  peerId: string,
  event: string,
  data: unknown,
): void {
  const peer = rooms.get(roomId)?.get(peerId)
  if (!peer) return
  const chunk = peer.encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  )
  try {
    peer.controller.enqueue(chunk)
  } catch {
    // stream already closed
  }
}

export function broadcast(
  roomId: string,
  fromId: string,
  event: string,
  data: unknown,
): void {
  const room = rooms.get(roomId)
  if (!room) return
  for (const [peerId, peer] of room) {
    if (peerId === fromId) continue
    const chunk = peer.encoder.encode(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
    try {
      peer.controller.enqueue(chunk)
    } catch {
      // stream already closed
    }
  }
}

export function roomExists(roomId: string): boolean {
  return rooms.has(roomId)
}

export function getExistingPeers(
  roomId: string,
): Array<{ id: string; name: string }> {
  const room = rooms.get(roomId)
  if (!room) return []
  return Array.from(room.entries()).map(([id, { name }]) => ({ id, name }))
}
