# 실시간 통신 도메인 - 엔티티 정의
> 최종 갱신: 2026-03-28

## PeerEntry
- **설명**: 서버 인메모리에서 한 피어의 SSE 스트림 컨트롤러와 이름을 보관하는 레코드. rooms Map의 값 타입으로 사용된다.
- **코드 위치**: `lib/signalingStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | name | string | 피어 표시 이름 | - |
  | controller | ReadableStreamDefaultController\<Uint8Array\> | SSE 스트림 쓰기 핸들 | - |
  | encoder | TextEncoder | 문자열 → Uint8Array 인코더 | - |
- **관계**: rooms Map의 `roomId → peerId → PeerEntry` 2단계 중첩 구조에서 리프 노드. addPeer로 생성되고 removePeer로 제거된다.

---

## PeerConn
- **설명**: 클라이언트 훅 내부에서 피어별 WebRTC 연결 상태를 추적하는 객체. P2P 모드에서는 RTCPeerConnection과 RTCDataChannel을 포함하고, 릴레이 모드에서는 name만 유지한다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | pc | RTCPeerConnection \| undefined | WebRTC 피어 연결 객체 (릴레이 모드에서 undefined) | - |
  | channel | RTCDataChannel \| undefined | 게임 메시지 전용 DataChannel | - |
  | name | string | 피어 표시 이름 | - |
  | isInitiator | boolean \| undefined | Offer 생성 주체 여부. sync_request 전송 판별에도 사용 | - |
  | remoteDescriptionSet | boolean \| undefined | setRemoteDescription 완료 여부. ICE 버퍼링 조건 | - |
  | pendingCandidates | RTCIceCandidateInit[] \| undefined | remoteDescription 설정 전 수신된 ICE candidate 버퍼 | - |
- **관계**: peersRef(Map\<string, PeerConn\>) 내에서 peerId를 키로 관리. connectedPeersRef(Set\<string\>)와 쌍을 이뤄 연결 완료 여부를 추적한다.

---

## DataMessage
- **설명**: WebRTC DataChannel 또는 서버 릴레이를 통해 피어 간에 교환되는 게임 메시지 유니온 타입. type 필드로 분기된다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | type | 'voted' \| 'reveal' \| 'reset' \| 'next' \| 'sync_request' \| 'sync_response' \| 'room_closed' \| 'kick' \| 'host_migrated' \| 'leaving' | 메시지 종류 식별자 | - |
  | from | string | (voted / reveal / sync_request) 발신 피어 ID | - |
  | vote | string | (reveal) 공개된 투표 값 | - |
  | state | SyncState | (sync_response) 전체 게임 상태 스냅샷 | room-management |
  | targetId | string | (kick) 강퇴 대상 피어 ID | - |
  | newHostId | string | (host_migrated) 새 호스트 피어 ID | - |
  | peerId | string | (leaving) 자발적 퇴장 피어 ID | - |
- **관계**: SyncState 타입을 `@/store/usePokerStore`에서 import. useWebRTC 훅의 onMessage 콜백 인자로 상위 컴포넌트(room-management 도메인)에 전달된다.

---

## TransportMode
- **설명**: 현재 메시지 전송 경로 상태를 나타내는 리터럴 유니온 타입. useWebRTC 훅이 반환하며 UI 표시 또는 동작 분기에 활용된다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | (값) | 'connecting' \| 'p2p' \| 'relay' | connecting: 초기 연결 시도 중 / p2p: WebRTC DataChannel 개통 / relay: 서버 릴레이 활성 | - |
- **관계**: useWebRTC 훅 내부 useState로 관리. P2P DataChannel open 시 'p2p', activateRelayMode 호출 시 'relay'로 전환.

---

## UseWebRTCOptions
- **설명**: useWebRTC 훅의 입력 파라미터 인터페이스. 방 식별 정보와 이벤트 콜백을 포함한다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | roomId | string | 입장한 방 ID | room-management |
  | myId | string | 현재 클라이언트의 피어 ID | room-management |
  | myName | string | 현재 클라이언트 표시 이름 | room-management |
  | enabled | boolean | SSE 연결 활성화 조건 플래그 | room-management |
  | onMessage | (msg: DataMessage) => void | DataMessage 수신 시 호출될 콜백 | room-management |
  | onPeerConnected | (peerId: string, name: string) => void | 피어 연결 완료 시 콜백 | room-management |
  | onPeerDisconnected | (peerId: string) => void | 피어 연결 해제 시 콜백 | room-management |
- **관계**: 모든 콜백 매개변수는 room-management 도메인의 `app/room/[roomId]/page.tsx`에서 주입된다.
