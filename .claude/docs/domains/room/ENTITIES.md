# 방 관리 도메인 - 엔티티 정의

> 최종 갱신: 2026-03-25

## Participant

- **설명**: 포커 세션 내 단일 참가자를 나타내는 클라이언트 측 객체. 투표 여부 및 투표값을 포함한다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string (UUID) | 참가자 고유 식별자 (crypto.randomUUID) | signaling (peerId로 사용) |
  | name | string | 참가자 닉네임 | - |
  | hasVoted | boolean | 현재 라운드 투표 완료 여부 | - |
  | vote | string \| undefined | 공개된 카드값 (reveal 후에만 설정) | - |
- **상태 전이**:
  - `hasVoted: false` → `hasVoted: true`: 카드 선택(selectCard) 또는 원격 voted 메시지 수신
  - `vote: undefined` → `vote: string`: 전원 투표 완료 후 reveal(revealVotes/setParticipantVote)
  - `hasVoted: true, vote: string` → `hasVoted: false, vote: 제거`: 라운드 초기화(resetRound) 또는 다음 티켓(nextTicket)
- **관계**:
  - `Participant[]` ← `PokerState.participants`: PokerState에 배열로 포함 (1:N)
  - `Participant.id` = `PeerEntry` key: signalingStore의 peerId와 동일 값 사용

---

## RoomEntry (서버 내부)

- **설명**: 서버(signalingStore)가 관리하는 방별 피어 연결 정보. SSE 스트림 컨트롤러를 보관하여 실시간 이벤트 전송에 사용된다. `globalThis` 패턴으로 HMR 재평가 시에도 유지된다.
- **코드 위치**: `lib/signalingStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | roomId | string (Map key) | 방 고유 식별자 (UUID) | room (방 유효성 검사), signaling |
  | peerId | string (내부 Map key) | 참가자 식별자 (Participant.id와 동일) | signaling |
  | name | string | 참가자 닉네임 | signaling |
  | controller | ReadableStreamDefaultController | SSE 이벤트 전송용 스트림 컨트롤러 | signaling |
  | encoder | TextEncoder | SSE 메시지 인코딩용 | signaling |
- **상태 전이**: 없음. addPeer(추가) / removePeer(제거) 두 가지 연산만 존재. room.size === 0이면 roomId 항목 자체가 삭제됨.
- **관계**:
  - `rooms: Map<roomId, Map<peerId, PeerEntry>>`: 방 → 피어 2중 Map 구조

---

## PokerState (room 관련 필드)

- **설명**: Zustand 전역 스토어(`usePokerStore`)에서 방 관리와 직접 관련된 필드 집합. sessionStorage에 persist되어 탭 새로고침 시에도 세션이 유지된다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | roomId | string \| null | 현재 입장한 방 ID (UUID) | room (유효성 검사 비교), signaling |
  | myId | string | 자신의 참가자 UUID | signaling (peerId로 사용) |
  | myName | string \| null | 자신의 닉네임 | - |
  | hostId | string | 현재 호스트의 참가자 UUID | room (isHost 판별) |
  | participants | Participant[] | 현재 방의 전체 참가자 목록 | room (대기화면 조건, 이탈 처리) |
  | phase | 'voting' \| 'revealed' | 현재 라운드 투표 단계 | poker (투표/결과 표시) |
- **상태 전이**:
  - `roomId: null` → `UUID`: createRoom() 또는 joinRoom() 호출 시
  - `roomId: UUID` → `null`: leaveRoom() 호출 시 (sessionStorage도 함께 삭제)
  - `hostId: A` → `hostId: B`: migrateHost(newHostId) 호출 시 (호스트 재접속)
  - `phase: 'voting'` → `'revealed'`: revealVotes() 호출 시
  - `phase: 'revealed'` → `'voting'`: resetRound() 또는 nextTicket() 호출 시
- **관계**:
  - `PokerState` ⊃ `Participant[]`: 참가자 목록 포함
  - `PokerState` ⊃ `JiraTicket[]`, `CompletedTicket[]`: 티켓 정보 포함 (poker 도메인)
