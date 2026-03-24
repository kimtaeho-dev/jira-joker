# 실시간 통신 도메인 - 엔티티 정의

> 최종 갱신: 2026-03-25

## PeerEntry

- **설명**: 서버(signalingStore) 인메모리에 보관되는 피어 레코드. SSE 스트림 컨트롤러를 통해 해당 피어에게 이벤트를 push한다. `globalThis` 싱글톤 패턴으로 HMR 재평가 시에도 상태를 유지한다.
- **코드 위치**: `lib/signalingStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | name | string | 피어의 표시 이름 | - |
  | controller | ReadableStreamDefaultController\<Uint8Array\> | SSE 스트림 컨트롤러 (enqueue로 이벤트 push) | - |
  | encoder | TextEncoder | SSE 프레임 인코더 | - |
- **상태 전이**: 없음 (addPeer로 생성, removePeer로 삭제)
- **관계**:
  - PeerEntry는 `rooms: Map<roomId, Map<peerId, PeerEntry>>` 구조로 관리됨 (1 room : N peers)

---

## PeerConn

- **설명**: 클라이언트(브라우저) 인메모리에서 `peersRef`(Map)로 관리되는 피어 연결 상태 객체. WebRTC P2P 모드에서는 RTCPeerConnection과 DataChannel을 보유하고, 릴레이 모드에서는 pc/channel이 undefined가 된다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | pc | RTCPeerConnection \| undefined | WebRTC 피어 연결 객체. 릴레이 모드에서는 undefined | - |
  | channel | RTCDataChannel \| undefined | 게임 메시지 전송용 DataChannel | - |
  | name | string | 피어 표시 이름 | - |
  | isInitiator | boolean \| undefined | 신규 피어(true)면 offer 생성 + sync_request 전송 주체 | - |
  | remoteDescriptionSet | boolean \| undefined | setRemoteDescription 완료 여부 (ICE 버퍼링 제어용) | - |
  | pendingCandidates | RTCIceCandidateInit[] \| undefined | remoteDescription 설정 전 수신된 ICE candidate 버퍼 | - |
- **상태 전이**: 없음 (DataChannel.readyState: `connecting` → `open` → `closed` 로 간접 추적)
- **관계**:
  - PeerConn은 `peersRef: Map<peerId, PeerConn>` 구조로 관리됨

---

## DataMessage

- **설명**: WebRTC DataChannel 또는 서버 릴레이를 통해 피어 간 교환되는 게임 메시지의 discriminated union 타입. `type` 필드로 메시지 종류를 구분한다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | type | 'voted' \| 'reveal' \| 'reset' \| 'next' \| 'sync_request' \| 'sync_response' \| 'room_closed' \| 'kick' \| 'host_migrated' \| 'leaving' | 메시지 종류 | - |
  | from | string | 발신 피어 ID (voted, reveal, sync_request, sync_response에 사용) | - |
  | vote | string | 공개된 투표값 (reveal 타입 전용) | poker |
  | state | SyncState | 전체 게임 상태 스냅샷 (sync_response 타입 전용) | poker |
  | targetId | string | 추방 대상 피어 ID (kick 타입 전용) | - |
  | newHostId | string | 새 호스트 피어 ID (host_migrated 타입 전용) | poker |
  | peerId | string | 이탈 피어 ID (leaving 타입 전용) | - |
- **상태 전이**: 없음 (단방향 메시지)
- **관계**: `SyncState`를 `@/store/usePokerStore`에서 직접 import하여 sync_response의 state 필드 타입으로 사용

---

## TransportMode

- **설명**: 현재 클라이언트의 실시간 전송 모드를 나타내는 string literal union. `useWebRTC` 훅이 반환하며 UI(PokerTable)에서 "서버 중계 모드" 배지 표시에 사용된다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | (값) | 'connecting' \| 'p2p' \| 'relay' | connecting: 초기 연결 중, p2p: WebRTC DataChannel 성공, relay: 서버 릴레이 모드 | poker |
- **상태 전이**:
  - `connecting` → `p2p`: DataChannel onopen 이벤트 발생 시 (WebRTC P2P 성공)
  - `connecting` → `relay`: 8초(RELAY_FALLBACK_TIMEOUT) 타임아웃 후 열린 DataChannel이 없을 때
- **관계**: `poker` 도메인의 PokerTable 컴포넌트가 소비
