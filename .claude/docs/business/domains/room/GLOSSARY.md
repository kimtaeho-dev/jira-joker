# 방 관리 도메인 - 용어집

> 최종 갱신: 2026-03-25

---

## D

### departedHostName (이탈 호스트 닉네임)
- **정의**: 비자발적으로 연결이 끊어진 호스트의 닉네임을 임시로 저장하는 값. 재접속 판별 시 동일 이름 여부를 확인하는 데 사용된다.
- **코드 표현**: `departedHostName` (local state, string | null)
- **유사어·혼동 주의**: hostId와는 다름. hostId는 UUID 기반 영구 식별자이고, departedHostName은 이름 기반 임시 재접속 판별용 값이다.
- **사용 위치**: room.호스트_재접속_보호 기능, onPeerConnected 콜백
- **예시**: 호스트가 "Alice"라는 닉네임으로 연결이 끊어지면 departedHostName = "Alice"로 저장됨

### disconnectReason (연결 해제 사유)
- **정의**: 참가자가 강제로 방에서 퇴장하게 된 원인을 나타내는 값. 방 종료 오버레이의 메시지 내용을 결정한다.
- **코드 표현**: `disconnectReason` (local state, 'host_left' | 'kicked' | null)
- **유사어·혼동 주의**: hostWaiting과는 다름. disconnectReason은 방 세션이 종료된 이유를 나타내고, hostWaiting은 호스트 재접속을 기다리는 일시적 상태다.
- **사용 위치**: room.방_종료_오버레이, room.이탈_호스트, room.참가자_추방
- **예시**: `'host_left'` → "방이 종료되었습니다" 오버레이, `'kicked'` → "방에서 추방되었습니다" 오버레이, `null` → 오버레이 미표시

---

## H

### host (호스트)
- **정의**: 방을 생성한 참가자. 방 종료, 참가자 추방, 투표 결과 진행 등 방 관리 권한을 단독으로 보유한다.
- **코드 표현**: `hostId` (PokerState 필드, string), `isHost()` (파생 함수 — myId === hostId)
- **유사어·혼동 주의**: 서버(signalingStore)는 hostId를 관리하지 않는다. 호스트 개념은 전적으로 클라이언트(Zustand) 기반이다. 서버 측에서 호스트 권한을 확인하는 로직은 존재하지 않는다.
- **사용 위치**: PokerState, room.이탈_호스트, room.호스트_재접속_보호, room.참가자_추방
- **예시**: createRoom() 호출 시 hostId = myId로 설정됨

### host_migrated (DataMessage 타입)
- **정의**: 호스트 재접속이 확인되었을 때 broadcast하는 DataChannel 메시지 타입. 새로운 hostId를 모든 참가자에게 동기화한다.
- **코드 표현**: `DataMessage` type 필드 값 `'host_migrated'`, `newHostId` 페이로드
- **유사어·혼동 주의**: migrateHost()는 로컬 상태를 변경하는 액션이고, host_migrated는 이를 다른 참가자에게 전파하는 메시지다.
- **사용 위치**: room.호스트_재접속_보호, hooks/useWebRTC.ts
- **예시**: `{ type: 'host_migrated', newHostId: 'uuid-...' }`

### hostWaiting (호스트 재접속 대기 상태)
- **정의**: 호스트의 연결이 비자발적으로 끊어진 후, 재접속을 기다리는 상태임을 나타내는 플래그.
- **코드 표현**: `hostWaiting` (local state, boolean)
- **유사어·혼동 주의**: disconnectReason과는 다름. hostWaiting이 true인 상태는 방이 종료된 것이 아니라 일시적으로 호스트가 없는 상태다.
- **사용 위치**: room.호스트_재접속_보호, room.대기_화면
- **예시**: 호스트 SSE 연결 끊김 → `hostWaiting = true` → "호스트 재접속 대기 중..." 오버레이 표시

---

## K

### kick (DataMessage 타입)
- **정의**: 호스트가 특정 참가자를 방에서 강제 퇴장시킬 때 broadcast하는 DataChannel 메시지 타입.
- **코드 표현**: `DataMessage` type 필드 값 `'kick'`, `targetId` 페이로드
- **유사어·혼동 주의**: leaving은 참가자의 자발적 이탈 메시지이고, kick은 호스트의 강제 퇴장 명령이다.
- **사용 위치**: room.참가자_추방, app/room/[roomId]/page.tsx handleKick
- **예시**: `{ type: 'kick', targetId: 'uuid-...' }`

---

## L

### leaving (DataMessage 타입)
- **정의**: 참가자가 능동적으로 방을 나갈 때 broadcast하는 DataChannel 메시지 타입. "나가기" 버튼 클릭 시와 beforeunload 이벤트에서 전송된다.
- **코드 표현**: `DataMessage` type 필드 값 `'leaving'`, `peerId` 페이로드
- **유사어·혼동 주의**: onPeerDisconnected(WebRTC 연결 단절)와 leaving(능동 이탈 알림)은 동일한 결과를 만들지만 경로가 다르다. 두 경로 모두 중복 처리 방지 로직으로 보호된다.
- **사용 위치**: room.이탈_참가자, room.beforeunload_이탈
- **예시**: `{ type: 'leaving', peerId: 'uuid-...' }`

---

## P

### participant (참가자)
- **정의**: 방에 연결된 모든 사용자를 가리키며 호스트도 포함된다. 투표 상태와 공개된 카드값을 보유한다.
- **코드 표현**: `Participant` 타입 (id: string, name: string, hasVoted: boolean, vote: string | undefined), `participants` 배열 (PokerState)
- **유사어·혼동 주의**: "호스트"는 participants 배열에 포함된 Participant 중 하나이며, hostId로 식별된다.
- **사용 위치**: PokerState, Participant 엔티티, 투표 기능 전반
- **예시**: `{ id: 'uuid-...', name: 'Alice', hasVoted: true, vote: undefined }` (아직 reveal 전)

---

## R

### room_closed (DataMessage 타입)
- **정의**: 호스트가 방을 종료할 때 모든 참가자에게 broadcast하는 DataChannel 메시지 타입. 수신 참가자는 disconnectReason을 'host_left'로 전환한다.
- **코드 표현**: `DataMessage` type 필드 값 `'room_closed'`
- **유사어·혼동 주의**: 서버 SSE의 peer_left 이벤트와는 다름. room_closed는 호스트가 의도적으로 방 전체를 닫을 때 사용하고, peer_left는 특정 참가자 한 명이 나갈 때 서버가 발행한다.
- **사용 위치**: room.이탈_호스트, room.방_종료_오버레이
- **예시**: `{ type: 'room_closed' }`

### roomId (방 ID)
- **정의**: 방을 식별하는 UUID 문자열. 방 생성 시 자동 생성되며 초대 URL의 경로 파라미터로도 사용된다.
- **코드 표현**: `roomId` (PokerState 필드, string | null), URL 경로 `/room/[roomId]`
- **유사어·혼동 주의**: storeRoomId(저장된 방 ID)와 URL의 roomId(파라미터)를 비교하는 로직이 핵심 진입 조건이다. 두 값이 일치하면 기존 세션으로 인정한다.
- **사용 위치**: PokerState, 방 유효성 검사, WebRTC 시그널링, API 라우트
- **예시**: `'3f2a1b4c-8d9e-4f7a-b5c6-1d2e3f4a5b6c'`

### roomValid (방 유효성 상태)
- **정의**: 방 유효성 검사 API의 결과를 나타내는 로컬 상태값. 검사 진행 중, 유효, 무효의 세 가지 상태를 가진다.
- **코드 표현**: `roomValid` (local state, boolean | null)
- **유사어·혼동 주의**: null은 검사 중을 의미하며, undefined나 false와 다르다. null일 때는 로딩 스피너가 표시된다.
- **사용 위치**: room.방_유효성_검사, app/room/[roomId]/page.tsx
- **예시**: `null` → 로딩 중, `true` → JoinRoomForm 표시, `false` → "방을 찾을 수 없습니다" 표시

---

## S

### signalingStore (시그널링 저장소)
- **정의**: 서버 측 인메모리 저장소. 각 방의 SSE 스트림 컨트롤러를 `roomId → peerId → PeerEntry` 구조로 관리한다. 방의 존재 여부 확인에도 사용된다.
- **코드 표현**: `lib/signalingStore.ts`, `rooms: Map<string, Map<string, PeerEntry>>`, `roomExists()` 함수
- **유사어·혼동 주의**: 서버는 hostId나 투표 상태 등 비즈니스 데이터를 저장하지 않는다. 오직 SSE 연결 관리와 방 존재 여부 확인만 담당한다.
- **사용 위치**: app/api/room/[roomId]/route.ts, app/api/signaling/[roomId]/route.ts
- **예시**: rooms.has('uuid-...') === true → 방 존재, rooms.has('uuid-...') === false → 방 없음
