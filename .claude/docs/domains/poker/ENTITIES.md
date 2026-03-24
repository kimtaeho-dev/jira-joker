# 포커 도메인 - 엔티티 정의

> 최종 갱신: 2026-03-25

## Participant

- **설명**: Planning Poker 세션에 참여 중인 단일 참가자의 식별 정보 및 현재 라운드 투표 상태
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | UUID, 세션 내 고유 식별자 | - |
  | name | string | 표시 닉네임 | - |
  | hasVoted | boolean | 현재 라운드 투표 완료 여부 (투표값 미포함) | - |
  | vote | string \| undefined | reveal 후에만 설정되는 실제 카드 값 | - |
- **상태 전이**:
  - hasVoted=false, vote=undefined → hasVoted=true, vote=undefined: `selectCard` 호출 (자신) 또는 `setParticipantVoted` (타인의 voted DataMessage 수신)
  - hasVoted=true, vote=undefined → hasVoted=true, vote=값: `revealVotes` 호출 (자신) 또는 `setParticipantVote` (타인의 reveal DataMessage 수신)
  - 임의 상태 → hasVoted=false, vote=undefined: `resetRound` 또는 `nextTicket` 호출로 라운드 리셋
- **관계**:
  - Participant[] ⊂ PokerState: PokerState의 participants 배열 구성 요소 (1:N)
  - Participant → SyncState: SyncState.participants로 P2P 전송됨

---

## JiraTicket

- **설명**: 투표 대상이 되는 Jira 이슈. GET /api/jira?type=issues 응답에서 생성되어 PokerState.tickets에 저장됨
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | Jira 내부 이슈 ID | jira |
  | key | string | Jira 이슈 키 (예: PROJ-42) | jira |
  | summary | string | 이슈 제목 | jira |
  | storyPoints | number \| undefined | 기존 SP 값 (customfield_10016) | jira |
  | description | string \| null \| undefined | 이슈 설명 (Cloud: ADF 변환, Server: 평문) | jira |
  | assignee | object \| null \| undefined | 담당자 (displayName, avatarUrl) | jira |
  | reporter | object \| null \| undefined | 보고자 (displayName, avatarUrl) | jira |
  | dueDate | string \| null \| undefined | 마감일 | jira |
  | priority | object \| null \| undefined | 우선순위 (name, iconUrl) | jira |
- **상태 전이**: 없음 (방 생성 시 로드 후 불변)
- **관계**:
  - JiraTicket[] ⊂ PokerState: PokerState.tickets 배열 구성 요소 (1:N)
  - JiraTicket ⊂ CompletedTicket: 투표 완료 시 CompletedTicket.ticket으로 참조됨

---

## JiraConfig

- **설명**: Jira API 호출에 필요한 인증 정보. 클라이언트 → /api/jira 프록시 헤더로 per-request 전달됨
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | domain | string | Jira 도메인 또는 Base URL | jira |
  | token | string | API Token (Cloud) 또는 PAT (Server·DC) | jira |
  | email | string \| undefined | Cloud 전용: Basic auth 이메일 | jira |
- **상태 전이**: 없음 (방 생성 시 1회 설정, 이후 불변)
- **관계**:
  - JiraConfig ⊂ PokerState: PokerState.jiraConfig로 보관 (1:1)
  - JiraConfig → SyncState: SyncState에는 포함되지 않음 (보안상 P2P 전송 제외)

---

## CompletedTicket

- **설명**: 라운드가 완료된(nextTicket 호출 시) 티켓과 해당 라운드의 전체 투표 결과를 묶은 불변 레코드
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | ticket | JiraTicket | 완료된 티켓 | - |
  | votes | Record\<string, string\> | 참가자 이름 → 투표 값 맵 | - |
  | result.mode | string | 최빈값 (가장 많이 선택된 카드) | - |
  | result.average | number | 숫자 투표값들의 평균 | - |
- **상태 전이**: 없음 (nextTicket 시 생성 후 불변; SessionSummary에서 읽기 전용)
- **관계**:
  - CompletedTicket[] ⊂ PokerState: PokerState.completedTickets 배열 구성 요소 (1:N)
  - CompletedTicket[] → SyncState: SyncState.completedTickets로 P2P 동기화됨

---

## SyncState

- **설명**: 신규 피어 합류 시 P2P DataChannel(또는 서버 릴레이)로 전달하는 전체 게임 상태 스냅샷. sync_request/sync_response DataMessage 페이로드
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | participants | Participant[] | 현재 참가자 목록 및 투표 상태 | - |
  | tickets | JiraTicket[] | 전체 티켓 목록 | jira |
  | currentTicketIndex | number | 현재 진행 중인 티켓 인덱스 | - |
  | phase | 'voting' \| 'revealed' | 현재 투표 단계 | - |
  | completedTickets | CompletedTicket[] | 완료된 티켓 이력 | - |
  | hostId | string | 현재 호스트의 myId | - |
- **상태 전이**: 없음 (전송 시점 스냅샷)
- **관계**:
  - SyncState ← PokerState: applySyncState 호출로 PokerState에 적용됨

---

## PokerState

- **설명**: 포커 세션 전체 상태를 관리하는 Zustand store. sessionStorage에 persist되어 새로고침 복구 지원
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | roomId | string \| null | 현재 방 UUID | room |
  | myId | string | 자신의 UUID (세션 내 고유) | - |
  | myName | string \| null | 자신의 닉네임 | - |
  | hostId | string | 현재 호스트의 UUID | - |
  | jiraConfig | JiraConfig \| null | Jira 인증 정보 | jira |
  | tickets | JiraTicket[] | 전체 투표 대상 티켓 목록 | jira |
  | phase | 'voting' \| 'revealed' | 현재 라운드 단계 | - |
  | myVote | string \| null | 자신이 선택한 카드 값 | - |
  | participants | Participant[] | 참가자 목록 | - |
  | currentTicketIndex | number | 현재 티켓 인덱스 | - |
  | completedTickets | CompletedTicket[] | 완료된 티켓 이력 | - |
- **상태 전이**:
  - phase: `voting` → `revealed`: 전원 투표 완료 + 2초 카운트다운 후 `revealVotes` 자동 호출
  - phase: `revealed` → `voting`: `resetRound` (Re-vote) 또는 `nextTicket` (다음 티켓) 호출 시
  - roomId: null → UUID: `createRoom` 또는 `joinRoom` 호출 시
  - roomId: UUID → null: `leaveRoom` 호출 시 (sessionStorage 삭제 포함)
  - hostId: 이전 → 신규: `migrateHost(newHostId)` 호출 시 (호스트 재접속 복원)
- **관계**:
  - PokerState → Participant[], JiraTicket[], CompletedTicket[], JiraConfig: 1:N 또는 1:1 포함 관계

---

## DataMessage

- **설명**: WebRTC DataChannel 및 서버 릴레이를 통해 피어 간 교환되는 실시간 메시지 타입 유니온
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | type | 'voted'\|'reveal'\|'reset'\|'next'\|'sync_request'\|'sync_response'\|'room_closed'\|'kick'\|'host_migrated'\|'leaving' | 메시지 종류 | - |
  | from | string | 발신자 myId (voted, reveal, sync_request 타입) | - |
  | vote | string | 카드 값 (reveal 타입) | - |
  | state | SyncState | 전체 게임 상태 (sync_response 타입) | - |
  | targetId | string | 추방 대상 myId (kick 타입) | - |
  | newHostId | string | 신규 호스트 myId (host_migrated 타입) | - |
  | peerId | string | 이탈 피어 myId (leaving 타입) | - |
- **상태 전이**: 없음 (이벤트 메시지 — 수신 시 PokerState 변이를 유발)
- **관계**:
  - DataMessage → PokerState: 수신 시 handleDataMessage 핸들러가 해당 store 액션 호출

---

## TransportMode

- **설명**: WebRTC 연결의 현재 전송 방식. useWebRTC hook이 반환하는 상태값으로 UI에 표시됨
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | (값) | 'connecting' \| 'p2p' \| 'relay' | 현재 연결 방식 | - |
- **상태 전이**:
  - `connecting` → `p2p`: RTCDataChannel onopen 성공 시
  - `connecting` → `relay`: 첫 피어 발견 후 8초 이내 DataChannel open 실패 시
  - (relay → p2p 역전이 없음: 릴레이 모드는 세션 내 불가역)
- **관계**:
  - TransportMode ⊂ useWebRTC 반환값: 현재 코드에서 transportMode를 PokerTable로 전달하는 연결은 미구현 상태 (CLAUDE.md에 언급되어 있으나 실제 배지 표시 구현 없음)
