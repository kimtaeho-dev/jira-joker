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
  | { type: 'leaving'; peerId: string }

// ICE 연결 타임아웃: checking 상태가 이 시간 이상 지속되면 ICE restart 시도
const ICE_TIMEOUT_MS = 15_000
// ICE restart 후에도 연결 안 되면 실패로 처리
const ICE_RESTART_TIMEOUT_MS = 10_000

interface UseWebRTCOptions {
  roomId: string
  myId: string
  myName: string
  enabled: boolean
  onMessage: (msg: DataMessage) => void
  onPeerConnected: (peerId: string, name: string) => void
  onPeerDisconnected: (peerId: string) => void
  onConnectionFailed?: () => void
}

function buildRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]

  // TURN 서버 환경변수 설정 시 relay fallback 추가 (회사 방화벽 환경 대응)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername ?? '',
      credential: turnCredential ?? '',
    })
  }

  return { iceServers }
}

const RTC_CONFIG = buildRtcConfig()

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
  onConnectionFailed,
}: UseWebRTCOptions): {
  broadcast: (msg: DataMessage) => void
  sendToPeer: (peerId: string, msg: DataMessage) => void
} {
  const peersRef = useRef<Map<string, PeerConn>>(new Map())
  const iceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const onMessageRef = useRef(onMessage)
  const onPeerConnectedRef = useRef(onPeerConnected)
  const onPeerDisconnectedRef = useRef(onPeerDisconnected)
  const onConnectionFailedRef = useRef(onConnectionFailed)

  // 최신 콜백 참조 유지
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onPeerConnectedRef.current = onPeerConnected }, [onPeerConnected])
  useEffect(() => { onPeerDisconnectedRef.current = onPeerDisconnected }, [onPeerDisconnected])
  useEffect(() => { onConnectionFailedRef.current = onConnectionFailed }, [onConnectionFailed])

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

      // ICE candidate 배치 전송 (100ms 윈도우로 묶어서 왕복 횟수 절감)
      let pendingCandidates: RTCIceCandidateInit[] = []
      let candidateTimer: ReturnType<typeof setTimeout> | null = null

      const flushCandidates = () => {
        if (pendingCandidates.length > 0) {
          sendSignal('ice_candidates', peerId, { candidates: pendingCandidates })
          pendingCandidates = []
        }
        candidateTimer = null
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          pendingCandidates.push(candidate.toJSON())
          if (!candidateTimer) {
            candidateTimer = setTimeout(flushCandidates, 100)
          }
        } else {
          // null candidate = gathering 완료, 잔여 후보 즉시 전송
          if (candidateTimer) clearTimeout(candidateTimer)
          flushCandidates()
        }
      }

      // ICE 연결 타임아웃: checking 상태가 장시간 지속되면 ICE restart → 재시도 후 실패 처리
      const clearIceTimer = () => {
        const timer = iceTimersRef.current.get(peerId)
        if (timer) {
          clearTimeout(timer)
          iceTimersRef.current.delete(peerId)
        }
      }

      let iceRestarted = false

      const startIceTimer = (timeoutMs: number) => {
        clearIceTimer()
        iceTimersRef.current.set(peerId, setTimeout(() => {
          // 타임아웃 시점에 아직 연결되지 않았으면
          if (pc.iceConnectionState === 'checking' || pc.iceConnectionState === 'new') {
            if (!iceRestarted) {
              // 첫 번째 타임아웃: ICE restart 시도
              iceRestarted = true
              try {
                pc.restartIce()
              } catch {
                // restartIce not supported
              }
              startIceTimer(ICE_RESTART_TIMEOUT_MS)
            } else {
              // ICE restart 후에도 연결 실패 → 정리
              pc.close()
              peersRef.current.delete(peerId)
              onPeerDisconnectedRef.current(peerId)
              onConnectionFailedRef.current?.()
            }
          }
        }, timeoutMs))
      }

      // 피어 연결 생성 시 타이머 시작
      startIceTimer(ICE_TIMEOUT_MS)

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          clearIceTimer()
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          clearIceTimer()
          peersRef.current.delete(peerId)
          onPeerDisconnectedRef.current(peerId)
        }
      }

      // iceConnectionState: connectionState보다 빠르게 실패 감지
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          clearIceTimer()
        } else if (pc.iceConnectionState === 'failed') {
          clearIceTimer()
          pc.close()
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

    // ICE candidates 배치 수신
    eventSource.addEventListener('ice_candidates', async (e) => {
      const { from, candidates } = JSON.parse((e as MessageEvent).data) as {
        from: string
        candidates: RTCIceCandidateInit[]
      }
      const entry = peersRef.current.get(from)
      if (!entry) return
      for (const candidate of candidates) {
        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch {
          // candidate error
        }
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

    const peers = peersRef.current
    const iceTimers = iceTimersRef.current

    return () => {
      eventSource.close()
      for (const { pc } of peers.values()) {
        pc.close()
      }
      peers.clear()
      // ICE 타이머 정리
      for (const timer of iceTimers.values()) {
        clearTimeout(timer)
      }
      iceTimers.clear()
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
