'use client'

import { useCallback, useEffect, useRef } from 'react'

import type { SyncState } from '@/store/usePokerStore'

export type DataMessage =
  | { type: 'voted'; from: string }
  | { type: 'reveal'; from: string; vote: string }
  | { type: 'reset' }
  | { type: 'next' }
  | { type: 'sync_request'; from: string }
  | { type: 'sync_response'; state: SyncState }
  | { type: 'room_closed' }
  | { type: 'kick'; targetId: string }
  | { type: 'host_migrated'; newHostId: string }

interface UseWebRTCOptions {
  roomId: string
  myId: string
  myName: string
  enabled: boolean
  onMessage: (msg: DataMessage) => void
  onPeerConnected: (peerId: string, name: string) => void
  onPeerDisconnected: (peerId: string) => void
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

interface PeerConn {
  pc: RTCPeerConnection
  channel?: RTCDataChannel
  name: string
}

export function useWebRTC({
  roomId,
  myId,
  myName,
  enabled,
  onMessage,
  onPeerConnected,
  onPeerDisconnected,
}: UseWebRTCOptions): {
  broadcast: (msg: DataMessage) => void
  sendToPeer: (peerId: string, msg: DataMessage) => void
} {
  const peersRef = useRef<Map<string, PeerConn>>(new Map())
  const onMessageRef = useRef(onMessage)
  const onPeerConnectedRef = useRef(onPeerConnected)
  const onPeerDisconnectedRef = useRef(onPeerDisconnected)

  // 최신 콜백 참조 유지
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onPeerConnectedRef.current = onPeerConnected }, [onPeerConnected])
  useEffect(() => { onPeerDisconnectedRef.current = onPeerDisconnected }, [onPeerDisconnected])

  const sendSignal = useCallback(
    (type: string, to: string | undefined, payload: unknown) => {
      fetch(`/api/signaling/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: myId, to, type, payload }),
      }).catch(() => {})
    },
    [roomId, myId],
  )

  const setupDataChannel = useCallback(
    (peerId: string, channel: RTCDataChannel, isInitiator: boolean) => {
      channel.onopen = () => {
        const entry = peersRef.current.get(peerId)
        if (!entry) return
        if (isInitiator) {
          // 신규 피어가 연결되면 sync_request 전송
          channel.send(JSON.stringify({ type: 'sync_request', from: myId }))
        }
        onPeerConnectedRef.current(peerId, entry.name)
      }

      channel.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as DataMessage
          onMessageRef.current(msg)
        } catch {
          // invalid JSON
        }
      }

      channel.onclose = () => {
        // DataChannel 닫힘은 peer_left SSE 이벤트로도 처리되므로 여기서는 아무것도 하지 않음
      }

      const entry = peersRef.current.get(peerId)
      if (entry) {
        peersRef.current.set(peerId, { ...entry, channel })
      }
    },
    [myId],
  )

  const createPeerConnection = useCallback(
    (peerId: string, peerName: string, isInitiator: boolean) => {
      const pc = new RTCPeerConnection(RTC_CONFIG)
      peersRef.current.set(peerId, { pc, name: peerName })

      // ICE candidate 전송
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sendSignal('ice_candidate', peerId, { candidate })
        }
      }

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          peersRef.current.delete(peerId)
          onPeerDisconnectedRef.current(peerId)
        }
      }

      if (isInitiator) {
        // Initiator(신규 피어)가 DataChannel 생성
        const channel = pc.createDataChannel('game')
        setupDataChannel(peerId, channel, true)

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              sendSignal('offer', peerId, { sdp: pc.localDescription })
            }
          })
          .catch(() => {})
      } else {
        // 기존 피어는 DataChannel 수신 대기
        pc.ondatachannel = ({ channel }) => {
          setupDataChannel(peerId, channel, false)
        }
      }

      return pc
    },
    [sendSignal, setupDataChannel],
  )

  useEffect(() => {
    if (!enabled) return

    const eventSource = new EventSource(
      `/api/signaling/${roomId}?peerId=${encodeURIComponent(myId)}&name=${encodeURIComponent(myName)}`,
    )

    // 기존 피어 목록 수신 → 각각에 Offer 전송 (신규 피어가 initiator)
    eventSource.addEventListener('room_state', (e) => {
      const { peers } = JSON.parse((e as MessageEvent).data) as {
        peers: Array<{ id: string; name: string }>
      }
      for (const peer of peers) {
        if (!peersRef.current.has(peer.id)) {
          createPeerConnection(peer.id, peer.name, true)
        }
      }
    })

    // 신규 피어 진입 알림 → 기존 피어가 Offer를 보내야 함
    // 플랜에 따라: peer_joined를 받은 쪽(기존 피어)이 initiator로 offer를 보낸다
    eventSource.addEventListener('peer_joined', (e) => {
      const { peerId, name } = JSON.parse((e as MessageEvent).data) as {
        peerId: string
        name: string
      }
      if (!peersRef.current.has(peerId)) {
        createPeerConnection(peerId, name, false)
      }
    })

    // Offer 수신 → Answer 전송
    eventSource.addEventListener('offer', async (e) => {
      const { from, sdp } = JSON.parse((e as MessageEvent).data) as {
        from: string
        sdp: RTCSessionDescriptionInit
      }

      let entry = peersRef.current.get(from)
      if (!entry) {
        // peer_joined가 오기 전에 offer가 도착하는 경우 방어 처리
        const pc = createPeerConnection(from, '', false)
        entry = peersRef.current.get(from)!
        void pc
      }

      const { pc } = entry
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (pc.localDescription) {
          sendSignal('answer', from, { sdp: pc.localDescription })
        }
      } catch {
        // negotiation error
      }
    })

    // Answer 수신
    eventSource.addEventListener('answer', async (e) => {
      const { from, sdp } = JSON.parse((e as MessageEvent).data) as {
        from: string
        sdp: RTCSessionDescriptionInit
      }
      const entry = peersRef.current.get(from)
      if (!entry) return
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
      } catch {
        // negotiation error
      }
    })

    // ICE candidate 수신
    eventSource.addEventListener('ice_candidate', async (e) => {
      const { from, candidate } = JSON.parse((e as MessageEvent).data) as {
        from: string
        candidate: RTCIceCandidateInit
      }
      const entry = peersRef.current.get(from)
      if (!entry) return
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // candidate error
      }
    })

    // 피어 퇴장
    eventSource.addEventListener('peer_left', (e) => {
      const { peerId } = JSON.parse((e as MessageEvent).data) as {
        peerId: string
      }
      const entry = peersRef.current.get(peerId)
      if (entry) {
        entry.pc.close()
        peersRef.current.delete(peerId)
      }
      onPeerDisconnectedRef.current(peerId)
    })

    return () => {
      eventSource.close()
      for (const { pc } of peersRef.current.values()) {
        pc.close()
      }
      peersRef.current.clear()
    }
  }, [enabled, roomId, myId, myName, createPeerConnection, sendSignal])

  const broadcast = useCallback((msg: DataMessage) => {
    const json = JSON.stringify(msg)
    for (const { channel } of peersRef.current.values()) {
      if (channel && channel.readyState === 'open') {
        channel.send(json)
      }
    }
  }, [])

  const sendToPeer = useCallback((peerId: string, msg: DataMessage) => {
    const entry = peersRef.current.get(peerId)
    if (entry?.channel && entry.channel.readyState === 'open') {
      entry.channel.send(JSON.stringify(msg))
    }
  }, [])

  return { broadcast, sendToPeer }
}
