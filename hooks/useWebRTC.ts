'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { SyncState } from '@/store/usePokerStore'

export type TransportMode = 'connecting' | 'p2p' | 'relay'

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

/** WebRTC P2P 연결 실패 시 서버 릴레이로 전환하기까지 대기 시간 */
const RELAY_FALLBACK_TIMEOUT = 8_000

interface PeerConn {
  pc?: RTCPeerConnection // relay 모드에서는 undefined
  channel?: RTCDataChannel
  name: string
  isInitiator?: boolean // sync_request 전송 주체 판별용
  remoteDescriptionSet?: boolean
  pendingCandidates?: RTCIceCandidateInit[]
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
  transportMode: TransportMode
} {
  const peersRef = useRef<Map<string, PeerConn>>(new Map())
  const relayModeRef = useRef(false)
  const relayFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [transportMode, setTransportMode] = useState<TransportMode>('connecting')
  const connectedPeersRef = useRef<Set<string>>(new Set())
  const onMessageRef = useRef(onMessage)
  const onPeerConnectedRef = useRef(onPeerConnected)
  const onPeerDisconnectedRef = useRef(onPeerDisconnected)

  // 최신 콜백 참조 유지
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])
  useEffect(() => {
    onPeerConnectedRef.current = onPeerConnected
  }, [onPeerConnected])
  useEffect(() => {
    onPeerDisconnectedRef.current = onPeerDisconnected
  }, [onPeerDisconnected])

  // ─── 서버 릴레이 전송 ───
  const sendRelay = useCallback(
    (msg: DataMessage, to?: string) => {
      fetch(`/api/signaling/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: myId, to, type: 'relay', payload: { msg } }),
      }).catch(() => {})
    },
    [roomId, myId],
  )

  // ─── WebRTC 시그널링 전송 ───
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

  // ─── 릴레이 모드 활성화 ───
  const activateRelayMode = useCallback(() => {
    if (relayModeRef.current) return
    relayModeRef.current = true
    setTransportMode('relay')
    console.info('[WebRTC] Switching to server relay mode (WebRTC unavailable)')

    // 기존 PeerConnection 정리 + 아직 연결 콜백 안 된 피어 처리
    for (const [peerId, entry] of peersRef.current) {
      if (entry.pc) {
        entry.pc.close()
        peersRef.current.set(peerId, { name: entry.name, isInitiator: entry.isInitiator })
      }
      if (!connectedPeersRef.current.has(peerId)) {
        connectedPeersRef.current.add(peerId)
        onPeerConnectedRef.current(peerId, entry.name)
        // initiator(신규 피어)만 sync_request 전송 — 호스트가 빈 sync_response를 받는 것 방지
        if (entry.isInitiator) {
          sendRelay({ type: 'sync_request', from: myId }, peerId)
        }
      }
    }
  }, [sendRelay, myId])

  // ─── 릴레이 폴백 타이머 ───
  const scheduleRelayFallback = useCallback(() => {
    if (relayModeRef.current || relayFallbackTimerRef.current) return
    relayFallbackTimerRef.current = setTimeout(() => {
      relayFallbackTimerRef.current = null
      if (relayModeRef.current) return

      // DataChannel이 하나도 열리지 않았으면 릴레이로 전환
      let hasOpenChannel = false
      for (const entry of peersRef.current.values()) {
        if (entry.channel?.readyState === 'open') {
          hasOpenChannel = true
          break
        }
      }
      if (!hasOpenChannel && peersRef.current.size > 0) {
        activateRelayMode()
      }
    }, RELAY_FALLBACK_TIMEOUT)
  }, [activateRelayMode])

  // ─── DataChannel 설정 ───
  const setupDataChannel = useCallback(
    (peerId: string, channel: RTCDataChannel, isInitiator: boolean) => {
      channel.onopen = () => {
        // WebRTC P2P 성공 → 릴레이 폴백 타이머 취소
        if (relayFallbackTimerRef.current) {
          clearTimeout(relayFallbackTimerRef.current)
          relayFallbackTimerRef.current = null
        }
        if (!relayModeRef.current) {
          setTransportMode('p2p')
        }

        const entry = peersRef.current.get(peerId)
        if (!entry) return
        if (isInitiator) {
          // 신규 피어가 연결되면 sync_request 전송
          channel.send(JSON.stringify({ type: 'sync_request', from: myId }))
        }
        connectedPeersRef.current.add(peerId)
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

  // ─── PeerConnection 생성 ───
  const createPeerConnection = useCallback(
    (peerId: string, peerName: string, isInitiator: boolean) => {
      if (relayModeRef.current) return undefined

      const pc = new RTCPeerConnection(RTC_CONFIG)
      peersRef.current.set(peerId, {
        pc,
        name: peerName,
        isInitiator,
        remoteDescriptionSet: false,
        pendingCandidates: [],
      })

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

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          connectedPeersRef.current.delete(peerId)
          peersRef.current.delete(peerId)
          onPeerDisconnectedRef.current(peerId)
        }
      }

      // iceConnectionState: connectionState보다 빠르게 실패 감지
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          pc.close()
          connectedPeersRef.current.delete(peerId)
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
          .catch((err) => console.warn('[WebRTC] offer creation error:', err))
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

  // ─── SSE 연결 + 이벤트 핸들러 ───
  useEffect(() => {
    if (!enabled) return

    const eventSource = new EventSource(
      `/api/signaling/${roomId}?peerId=${encodeURIComponent(myId)}&name=${encodeURIComponent(myName)}`,
    )

    // 기존 피어 목록 수신
    eventSource.addEventListener('room_state', (e) => {
      const { peers } = JSON.parse((e as MessageEvent).data) as {
        peers: Array<{ id: string; name: string }>
      }
      if (peers.length === 0) return

      if (relayModeRef.current) {
        // 릴레이 모드: WebRTC 없이 즉시 연결 (room_state를 받는 쪽 = 신규 피어 = initiator)
        for (const peer of peers) {
          if (!peersRef.current.has(peer.id)) {
            peersRef.current.set(peer.id, { name: peer.name, isInitiator: true })
            connectedPeersRef.current.add(peer.id)
            onPeerConnectedRef.current(peer.id, peer.name)
            sendRelay({ type: 'sync_request', from: myId }, peer.id)
          }
        }
      } else {
        // WebRTC 모드: P2P 시도 + 폴백 타이머 시작
        scheduleRelayFallback()
        for (const peer of peers) {
          if (!peersRef.current.has(peer.id)) {
            createPeerConnection(peer.id, peer.name, true)
          }
        }
      }
    })

    // 신규 피어 진입
    eventSource.addEventListener('peer_joined', (e) => {
      const { peerId, name } = JSON.parse((e as MessageEvent).data) as {
        peerId: string
        name: string
      }
      if (peersRef.current.has(peerId)) return

      if (relayModeRef.current) {
        // 릴레이 모드: 즉시 연결 처리 (peer_joined를 받는 쪽 = 기존 피어 = non-initiator, sync_request 안 보냄)
        peersRef.current.set(peerId, { name, isInitiator: false })
        connectedPeersRef.current.add(peerId)
        onPeerConnectedRef.current(peerId, name)
      } else {
        // WebRTC 모드: PeerConnection 생성 (기존 피어로서 offer 대기)
        createPeerConnection(peerId, name, false)
        scheduleRelayFallback()
      }
    })

    // Offer 수신 → Answer 전송
    eventSource.addEventListener('offer', async (e) => {
      if (relayModeRef.current) return

      const { from, sdp } = JSON.parse((e as MessageEvent).data) as {
        from: string
        sdp: RTCSessionDescriptionInit
      }

      let entry = peersRef.current.get(from)
      if (!entry) {
        // peer_joined가 오기 전에 offer가 도착하는 경우 방어 처리
        createPeerConnection(from, '', false)
        entry = peersRef.current.get(from)!
      }

      if (!entry.pc) return
      const { pc } = entry
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        // remoteDescription 설정 완료 → 버퍼링된 ICE candidates 일괄 적용
        entry.remoteDescriptionSet = true
        if (entry.pendingCandidates) {
          for (const candidate of entry.pendingCandidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
              console.warn('[WebRTC] buffered addIceCandidate failed:', err)
            }
          }
          entry.pendingCandidates = []
        }
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (pc.localDescription) {
          sendSignal('answer', from, { sdp: pc.localDescription })
        }
      } catch (err) {
        console.warn('[WebRTC] offer negotiation error:', err)
      }
    })

    // Answer 수신
    eventSource.addEventListener('answer', async (e) => {
      if (relayModeRef.current) return

      const { from, sdp } = JSON.parse((e as MessageEvent).data) as {
        from: string
        sdp: RTCSessionDescriptionInit
      }
      const entry = peersRef.current.get(from)
      if (!entry?.pc) return
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        // remoteDescription 설정 완료 → 버퍼링된 ICE candidates 일괄 적용
        entry.remoteDescriptionSet = true
        if (entry.pendingCandidates) {
          for (const candidate of entry.pendingCandidates) {
            try {
              await entry.pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
              console.warn('[WebRTC] buffered addIceCandidate failed:', err)
            }
          }
          entry.pendingCandidates = []
        }
      } catch (err) {
        console.warn('[WebRTC] answer negotiation error:', err)
      }
    })

    // ICE candidates 배치 수신
    eventSource.addEventListener('ice_candidates', async (e) => {
      if (relayModeRef.current) return

      const { from, candidates } = JSON.parse((e as MessageEvent).data) as {
        from: string
        candidates: RTCIceCandidateInit[]
      }
      const entry = peersRef.current.get(from)
      if (!entry?.pc) return

      if (!entry.remoteDescriptionSet) {
        // remoteDescription 설정 전이면 버퍼에 쌓아두기
        if (!entry.pendingCandidates) entry.pendingCandidates = []
        entry.pendingCandidates.push(...candidates)
        return
      }

      for (const candidate of candidates) {
        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.warn('[WebRTC] addIceCandidate failed:', err)
        }
      }
    })

    // ─── 서버 릴레이 메시지 수신 ───
    eventSource.addEventListener('relay', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { from: string; msg: DataMessage }
      if (data.msg) {
        onMessageRef.current(data.msg)
      }
    })

    // 피어 퇴장
    eventSource.addEventListener('peer_left', (e) => {
      const { peerId } = JSON.parse((e as MessageEvent).data) as {
        peerId: string
      }
      const entry = peersRef.current.get(peerId)
      if (entry?.pc) {
        entry.pc.close()
      }
      peersRef.current.delete(peerId)
      connectedPeersRef.current.delete(peerId)
      onPeerDisconnectedRef.current(peerId)
    })

    return () => {
      eventSource.close()
      if (relayFallbackTimerRef.current) {
        clearTimeout(relayFallbackTimerRef.current)
        relayFallbackTimerRef.current = null
      }
      for (const entry of peersRef.current.values()) {
        entry.pc?.close()
      }
      peersRef.current.clear()
      connectedPeersRef.current.clear()
    }
  }, [
    enabled,
    roomId,
    myId,
    myName,
    createPeerConnection,
    sendSignal,
    sendRelay,
    scheduleRelayFallback,
  ])

  // ─── 메시지 전송 (WebRTC P2P / 서버 릴레이 자동 분기) ───
  const broadcast = useCallback(
    (msg: DataMessage) => {
      if (relayModeRef.current) {
        sendRelay(msg)
        return
      }
      const json = JSON.stringify(msg)
      for (const { channel } of peersRef.current.values()) {
        if (channel && channel.readyState === 'open') {
          channel.send(json)
        }
      }
    },
    [sendRelay],
  )

  const sendToPeer = useCallback(
    (peerId: string, msg: DataMessage) => {
      if (relayModeRef.current) {
        sendRelay(msg, peerId)
        return
      }
      const entry = peersRef.current.get(peerId)
      if (entry?.channel && entry.channel.readyState === 'open') {
        entry.channel.send(JSON.stringify(msg))
      }
    },
    [sendRelay],
  )

  return { broadcast, sendToPeer, transportMode }
}
