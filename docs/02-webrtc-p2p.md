# Chapter 02: WebRTC P2P 실시간 통신

## 관련 파일

| 파일                                  | 역할                                                       |
| ------------------------------------- | ---------------------------------------------------------- |
| `lib/signalingStore.ts`               | 시그널링 서버 — SSE 컨트롤러 저장 및 메시지 릴레이         |
| `app/api/signaling/[roomId]/route.ts` | SSE 연결 + POST 시그널 릴레이 API                          |
| `hooks/useWebRTC.ts`                  | 클라이언트 WebRTC 훅 — 연결 수립, DataChannel, 메시지 처리 |

---

## 1. WebRTC 기본 개념

WebRTC(Web Real-Time Communication)는 브라우저 간 **서버를 거치지 않고** 직접 데이터를 주고받는 P2P 통신 기술이다.

**핵심 용어:**

| 용어                                             | 설명                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| **SDP** (Session Description Protocol)           | 연결 설정 정보 (코덱, 네트워크 정보 등)를 교환하는 프로토콜        |
| **ICE** (Interactive Connectivity Establishment) | NAT/방화벽 뒤의 피어를 찾아 최적 경로를 결정하는 프레임워크        |
| **STUN** 서버                                    | 자신의 공인 IP/포트를 알아내기 위한 경량 서버                      |
| **Signaling**                                    | P2P 연결 수립 전 SDP/ICE 정보를 중개하는 서버 (WebRTC 표준 외)     |
| **DataChannel**                                  | P2P 연결 위에서 임의의 데이터를 주고받는 채널 (이 프로젝트의 핵심) |

이 프로젝트에서는 Google의 공개 STUN 서버를 사용한다:

```ts
// hooks/useWebRTC.ts:27-29
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}
```

---

## 2. Full Mesh 토폴로지

이 프로젝트는 **Full Mesh** 네트워크를 사용한다. 모든 참가자가 서로 직접 연결된다.

```
     A ──── B
     │ ╲  ╱ │
     │  ╳   │
     │ ╱  ╲ │
     C ──── D

     4명 → 6개 연결 (N*(N-1)/2)
```

**장점:**

- 구현이 단순 — 중앙 서버 없이 모든 피어에게 직접 메시지 전송
- 지연 시간 최소화 — 중간 홉 없음
- 서버 비용 없음 — 시그널링 이후 서버 관여 불필요

**단점 및 제약:**

- 연결 수가 N^2로 증가 → **소규모 세션(~10명)에 적합**
- Planning Poker는 보통 5-10명이므로 Full Mesh가 최적

---

## 3. 시그널링 서버 아키텍처

P2P 연결을 수립하려면 SDP/ICE 정보를 교환할 중개 서버가 필요하다. 이 프로젝트에서는 Next.js API Route + SSE로 시그널링을 구현한다.

### 3.1 `signalingStore.ts` — 모듈 레벨 싱글턴

```ts
// lib/signalingStore.ts:1-8
interface PeerEntry {
  name: string
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
}

// roomId → peerId → PeerEntry
const rooms = new Map<string, Map<string, PeerEntry>>()
```

모듈 레벨 `Map`으로 모든 SSE 연결을 메모리에 유지한다. Next.js가 같은 프로세스에서 실행되므로 API Route 간에 상태를 공유할 수 있다.

**함수별 역할:**

| 함수                                                 | 역할                                          |
| ---------------------------------------------------- | --------------------------------------------- |
| `addPeer(roomId, peerId, name, controller, encoder)` | 방에 피어 등록 + SSE controller 저장          |
| `removePeer(roomId, peerId)`                         | 피어 제거, 방이 비면 방 자체도 삭제 (L29)     |
| `sendToPeer(roomId, peerId, event, data)`            | 특정 피어에게 SSE 이벤트 유니캐스트           |
| `broadcast(roomId, fromId, event, data)`             | 발신자 제외 방 전체에 SSE 이벤트 브로드캐스트 |
| `getExistingPeers(roomId)`                           | 방의 피어 목록 반환 (`[{ id, name }]`)        |
| `roomExists(roomId)`                                 | 방 존재 여부 확인 (L71-72)                    |

### 3.2 시그널링 Route — SSE GET

```ts
// app/api/signaling/[roomId]/route.ts:14-72 (GET)
```

SSE 연결 시 다음 순서로 동작한다:

1. **addPeer** — 방에 피어 등록
2. **room_state** 이벤트 전송 — 기존 피어 목록을 신규 피어에게 알림
3. **peer_joined** broadcast — 기존 피어들에게 신규 피어 진입 알림
4. **heartbeat** — 30초 간격으로 연결 유지
5. **abort cleanup** — 연결 종료 시 피어 제거 + `peer_left` broadcast

### 3.3 시그널링 Route — POST 릴레이

```ts
// app/api/signaling/[roomId]/route.ts:75-96
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const body = (await request.json()) as {
    from: string
    to?: string
    type: string
    payload: unknown
  }

  const { from, to, type, payload } = body

  if (to) {
    sendToPeer(roomId, to, type, { from, ...(payload as object) })
  } else {
    broadcast(roomId, from, type, { from, ...(payload as object) })
  }

  return new Response(null, { status: 204 })
}
```

`to` 필드 유무로 **유니캐스트**(특정 피어) / **브로드캐스트**(방 전체) 분기한다. SDP offer/answer는 유니캐스트, ICE candidate도 유니캐스트로 전송된다.

---

## 4. 연결 수립 시퀀스

새로운 피어(Peer C)가 기존 피어(Peer A, B)가 있는 방에 참여하는 과정:

```
Peer C (신규)              Signaling Server              Peer A (기존)
    │                            │                            │
    │── SSE GET ────────────────→│                            │
    │                            │── addPeer(C)               │
    │←── room_state [{A},{B}]────│                            │
    │                            │── peer_joined(C) ─────────→│
    │                            │                            │
    │  [C: A,B 각각에 대해]         │                            │
    │  createPeerConnection      │                            │
    │  (initiator=true)          │                            │
    │  createDataChannel('game') │                            │
    │  createOffer()             │                            │
    │                            │                            │
    │── POST offer (to:A) ──────→│── SSE offer ──────────────→│
    │                            │                            │
    │                            │        setRemoteDescription│
    │                            │        createAnswer()      │
    │                            │                            │
    │                            │←── POST answer (to:C) ─────│
    │←── SSE answer ─────────────│                            │
    │                            │                            │
    │── ICE candidate ──────────→│── SSE ice_candidate ──────→│
    │←── SSE ice_candidate ──────│←── ICE candidate ──────────│
    │                            │                            │
    │═══════ DataChannel open ════════════════════════════════│
    │                            │                            │
    │── sync_request ════════════════════════════════════════→│
    │←══════════════════════════════════ sync_response ───────│
```

핵심: **신규 피어가 initiator** — room_state에서 받은 기존 피어 목록을 순회하며 각각에게 offer를 전송한다.

---

## 5. `useWebRTC` 훅 분석

### 5.1 `createPeerConnection` (L103-149)

```ts
// hooks/useWebRTC.ts:103-149
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
```

**initiator vs responder 분기:**

- **Initiator** (L126-138): `pc.createDataChannel('game')` → `createOffer()` → 시그널링 서버로 offer 전송
- **Responder** (L139-143): `pc.ondatachannel` 이벤트 대기 — 상대방이 만든 DataChannel을 수신

### 5.2 `setupDataChannel` (L70-101)

```ts
// hooks/useWebRTC.ts:70-101
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

    // ...
  },
  [myId],
)
```

- `onopen`: DataChannel이 열리면 initiator가 `sync_request`를 보내 현재 게임 상태를 요청
- `onmessage`: 수신된 JSON을 파싱하여 `onMessage` 콜백으로 전달

### 5.3 연결 해제 이중 감지

피어 이탈은 **두 가지 경로**로 감지된다:

1. **SSE `peer_left` 이벤트** (L241-251):

```ts
// hooks/useWebRTC.ts:241-251
eventSource.addEventListener('peer_left', (e) => {
  const { peerId } = JSON.parse((e as MessageEvent).data) as { peerId: string }
  const entry = peersRef.current.get(peerId)
  if (entry) {
    entry.pc.close()
    peersRef.current.delete(peerId)
  }
  onPeerDisconnectedRef.current(peerId)
})
```

2. **`pc.onconnectionstatechange`** (L115-124):

```ts
// hooks/useWebRTC.ts:115-124
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
```

SSE는 서버 측 감지(abort signal), `connectionstatechange`는 WebRTC 레이어 감지다. 이중 감지로 어느 한쪽이 늦더라도 빠르게 이탈을 처리한다.

### 5.4 Cleanup (L253-259)

```ts
// hooks/useWebRTC.ts:253-259
return () => {
  eventSource.close()
  for (const { pc } of peersRef.current.values()) {
    pc.close()
  }
  peersRef.current.clear()
}
```

useEffect의 cleanup 함수에서 SSE 연결과 모든 RTCPeerConnection을 정리한다. 컴포넌트 언마운트 또는 dependency 변경 시 실행된다.

---

## 6. DataMessage 프로토콜

DataChannel을 통해 교환되는 메시지 타입은 8가지다:

```ts
// hooks/useWebRTC.ts:7-15
export type DataMessage =
  | { type: 'voted'; from: string }
  | { type: 'reveal'; from: string; vote: string }
  | { type: 'reset' }
  | { type: 'next' }
  | { type: 'sync_request'; from: string }
  | { type: 'sync_response'; state: SyncState }
  | { type: 'room_closed' }
  | { type: 'kick'; targetId: string }
```

| 타입            | 발신자      | 수신자        | 트리거            | 역할                              |
| --------------- | ----------- | ------------- | ----------------- | --------------------------------- |
| `voted`         | 투표한 피어 | 전체          | 카드 선택         | 투표 완료 상태만 알림 (값은 숨김) |
| `reveal`        | 모든 피어   | 전체          | 카운트다운 종료   | 실제 투표값 공개                  |
| `reset`         | 호스트      | 전체          | Re-vote 버튼      | 라운드 초기화                     |
| `next`          | 호스트      | 전체          | Next Ticket 버튼  | 다음 티켓으로 이동                |
| `sync_request`  | 신규 피어   | 기존 피어 1명 | DataChannel open  | 현재 게임 상태 요청               |
| `sync_response` | 기존 피어   | 신규 피어     | sync_request 수신 | 전체 게임 상태 전송               |
| `room_closed`   | 호스트      | 전체          | 호스트 나가기     | 방 종료 알림                      |
| `kick`          | 호스트      | 전체          | 추방 버튼         | 특정 참가자 추방                  |

**설계 포인트:** `voted` 메시지는 투표 **완료 여부**만 전달하고 실제 값은 보내지 않는다. 이를 통해 투표가 완료되기 전까지 다른 참가자의 선택이 노출되지 않는다.

---

## 7. Stale Closure 방지 Ref 패턴

React 훅에서 콜백 함수가 오래된 상태를 참조하는 **stale closure** 문제를 방지하기 위해 Ref 패턴을 사용한다:

```ts
// hooks/useWebRTC.ts:50-57
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
```

**왜 필요한가?**

`useEffect` 내부의 EventSource 이벤트 핸들러는 effect가 생성된 시점의 변수를 캡처한다 (클로저). 이후 `onMessage` 등의 콜백이 변경되어도 핸들러는 여전히 이전 버전을 참조한다. Ref는 항상 최신 값을 가리키므로 `onMessageRef.current(msg)` 호출 시 최신 콜백이 실행된다.

같은 패턴이 Room Page에서도 사용된다:

```ts
// app/room/[roomId]/page.tsx:46-47, 89-91
const myVoteRef = useRef(myVote)
useEffect(() => {
  myVoteRef.current = myVote
}, [myVote])

const broadcastRef = useRef<(msg: DataMessage) => void>(() => {})
const sendToPeerRef = useRef<(peerId: string, msg: DataMessage) => void>(() => {})
```

- `myVoteRef`: reveal 시점에 최신 투표값 참조
- `broadcastRef` / `sendToPeerRef`: WebRTC 초기화 전에도 안전하게 참조 가능한 래퍼

---

## Key Takeaways

- **시그널링은 연결 수립 전까지만 필요** — P2P 연결 후에는 DataChannel로 직접 통신하며 서버 관여 없음
- **Full Mesh는 소규모에 최적** — Planning Poker(5-10명)에 적합, 대규모에는 SFU/MCU 토폴로지가 필요
- **initiator/responder 구분이 핵심** — 누가 DataChannel을 만들고 offer를 보내는지 명확히 정의해야 한다
- **이중 감지로 견고성 확보** — SSE peer_left + connectionstatechange 두 경로로 피어 이탈을 감지
- **Ref 패턴으로 stale closure 방지** — 장기 실행 effect 내에서 최신 콜백/상태를 참조하는 필수 패턴
