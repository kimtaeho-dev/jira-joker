# 포커 게임 도메인 - 엔티티 정의
> 최종 갱신: 2026-03-28

---

## Participant
- **설명**: 게임 세션에 참여 중인 개별 사용자를 나타낸다. 투표 여부와 투표 값을 포함하며, 공개 전까지 vote는 undefined이다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | crypto.randomUUID()로 생성된 고유 식별자 | - |
  | name | string | 참가자 닉네임 | - |
  | hasVoted | boolean | 투표 완료 여부 (공개 전 체크 표시용) | - |
  | vote | string \| undefined | 투표한 카드 값; 공개(revealVotes) 이후에만 채워짐 | - |
- **상태 전이**:
  - `hasVoted=false, vote=undefined` → `hasVoted=true, vote=undefined`: selectCard() 호출 시 (본인), 또는 'voted' 메시지 수신 시 (타인)
  - `hasVoted=true, vote=undefined` → `hasVoted=true, vote=string`: revealVotes() 호출 시 (본인), 또는 'reveal' 메시지 수신 시 (타인)
  - `hasVoted=true, vote=string` → `hasVoted=false, vote=undefined`: resetRound() 또는 nextTicket() 호출 시 (전체 초기화)
- **관계**: PokerState가 Participant[] 배열을 보유. CompletedTicket.votes에 이름→투표값으로 스냅샷 기록됨.

---

## JiraTicket
- **설명**: Planning Poker 추정 대상이 되는 Jira 이슈를 나타낸다. jira-integration 도메인에서 생성되어 createRoom() 호출 시 poker-game 도메인으로 전달된다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | Jira 이슈 내부 ID | jira-integration |
  | key | string | Jira 이슈 키 (예: PROJ-123) | jira-integration |
  | summary | string | 이슈 제목 | jira-integration |
  | storyPoints | number \| undefined | 현재 스토리 포인트 값 | jira-integration |
  | description | string \| null \| undefined | 이슈 설명 | jira-integration |
  | assignee | { displayName: string; avatarUrl?: string } \| null \| undefined | 담당자 | jira-integration |
  | reporter | { displayName: string; avatarUrl?: string } \| null \| undefined | 보고자 | jira-integration |
  | dueDate | string \| null \| undefined | 마감일 | jira-integration |
  | priority | { name: string; iconUrl?: string } \| null \| undefined | 우선순위 | jira-integration |
- **상태 전이**: 없음 (poker-game 도메인 내에서 JiraTicket 값은 불변; completedTickets에 스냅샷으로 기록됨)
- **관계**: PokerState.tickets[]에 보관. CompletedTicket.ticket으로 스냅샷 참조. currentTicketIndex로 현재 티켓을 가리킴.

---

## JiraConfig
- **설명**: Jira 인스턴스 연결에 필요한 인증 정보를 담는다. jira-integration 도메인에서 수집되어 createRoom() 시 전달되며, 스토어에 persist된다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | domain | string | Jira 인스턴스 도메인 | jira-integration |
  | token | string | API Token (Cloud) 또는 PAT (Server/DC) | jira-integration |
  | email | string \| undefined | Cloud: 필수. Server/DC: 없음 | jira-integration |
- **상태 전이**: 없음
- **관계**: PokerState.jiraConfig에 단일 참조. Jira SP 자동 반영 기능(계획됨)에서 사용됨.

---

## CompletedTicket
- **설명**: 투표가 완료되어 다음 티켓으로 넘어간 티켓의 결과 스냅샷이다. nextTicket() 호출 시 생성된다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | ticket | JiraTicket | 추정 대상 티켓 스냅샷 | - |
  | votes | Record\<string, string\> | 참가자 이름 → 투표 값 맵 | - |
  | result.mode | string | 최빈 투표값 | - |
  | result.average | number | 숫자 투표값 평균 | - |
- **상태 전이**: 없음 (불변 스냅샷)
- **관계**: PokerState.completedTickets[]에 누적. SessionSummary와 TicketHistory에서 표시됨. SyncState에 포함되어 P2P 동기화됨.

---

## SyncState
- **설명**: P2P DataChannel을 통해 방 상태를 전송하기 위한 동기화 페이로드 타입이다. 신규 참가자가 sync_request를 보내면 기존 참가자(주로 호스트)가 sync_response로 반환한다.
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | participants | Participant[] | 현재 참가자 목록 | - |
  | tickets | JiraTicket[] | 전체 티켓 목록 | - |
  | currentTicketIndex | number | 현재 진행 중인 티켓 인덱스 | - |
  | phase | 'voting' \| 'revealed' | 현재 투표 단계 | - |
  | completedTickets | CompletedTicket[] | 완료된 티켓 결과 목록 | - |
  | hostId | string | 현재 호스트 ID | - |
- **상태 전이**: 없음 (전송용 페이로드)
- **관계**: hooks/useWebRTC.ts의 DataMessage 타입에서 sync_response 페이로드로 사용됨. applySyncState()로 스토어에 병합됨.

---

## DataMessage
- **설명**: WebRTC DataChannel 또는 서버 릴레이를 통해 참가자 간 전달되는 게임 이벤트 메시지의 유니온 타입이다.
- **코드 위치**: `hooks/useWebRTC.ts`
- **주요 필드**:
  | 메시지 type | 추가 필드 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | voted | from: string | 카드 선택 알림 | - |
  | reveal | from: string, vote: string | 투표값 공개 | - |
  | reset | - | 라운드 초기화 | - |
  | next | - | 다음 티켓으로 이동 | - |
  | sync_request | from: string | 상태 동기화 요청 | - |
  | sync_response | state: SyncState | 상태 동기화 응답 | - |
  | room_closed | - | 방 종료 알림 | - |
  | kick | targetId: string | 참가자 추방 | - |
  | host_migrated | newHostId: string | 호스트 변경 알림 | - |
  | leaving | peerId: string | 정상 이탈 알림 | - |
- **상태 전이**: 없음 (메시지 타입)
- **관계**: useWebRTC 훅의 broadcast()/sendToPeer()로 전송. RoomPage의 handleDataMessage()에서 수신 및 스토어 action 위임.
