# 포커 게임 도메인 - 용어집

> 최종 갱신: 2026-03-25

---

## A

### allVoted (전원 투표 완료)
- **정의**: 현재 라운드에서 모든 참가자가 카드를 선택한 상태. 2인 이상 참가자가 모두 hasVoted=true일 때 충족된다. 이 조건이 충족되면 2초 카운트다운이 시작된다.
- **코드 표현**: `allVoted()` (파생 함수), `isAllVoted` (컴포넌트 내 지역 변수)
- **유사어·혼동 주의**: `hasVoted`(단일 참가자의 투표 완료 여부)와 구별. `allVoted`는 방 전체의 투표 완료 여부
- **사용 위치**: PokerState.allVoted() 파생 함수, app/room/[roomId]/page.tsx isAllVoted 조건
- **예시**: 참가자 3명이 모두 카드를 선택했을 때 allVoted=true

---

### average (평균)
- **정의**: 카드 공개 후 숫자로 변환 가능한 투표값들의 산술 평균. '?', '☕'는 계산에서 제외된다. 모든 참가자가 비숫자 카드를 선택하면 null을 반환한다.
- **코드 표현**: `average()` (PokerState 파생 함수), `CompletedTicket.result.average`
- **유사어·혼동 주의**: `mode`(최빈값)와 함께 결과를 표시하지만 서로 다른 집계 방식. average는 숫자 카드만 포함, mode는 모든 카드 포함
- **사용 위치**: PokerState.average(), CompletedTicket.result, SessionSummary, PokerTable(TableCenter)
- **예시**: 참가자 4명이 1, 2, 3, '?'를 선택했을 때 average = (1+2+3)/3 = 2.0

---

### authMode (인증 방식)
- **정의**: Jira 연결 시 사용하는 인증 방식의 선택. 'cloud'는 Jira Cloud(이메일+API Token, Basic Auth), 'server'는 Jira Server·DC(Personal Access Token, Bearer Auth)를 의미한다.
- **코드 표현**: `authMode: 'cloud' | 'server'` (CreateRoomWizard 상태)
- **유사어·혼동 주의**: Jira Cloud와 Jira Server는 API 버전(v3/v2)과 인증 헤더 방식이 다르므로 반드시 구별해야 한다. Cloud는 email 필드 필수, Server는 email 불필요
- **사용 위치**: poker.방_생성_위저드 (CreateRoomWizard Step 1)
- **예시**: cloud → `Authorization: Basic base64(email:token)`, server → `Authorization: Bearer {PAT}`

---

## C

### CARD_VALUES (카드 값 목록)
- **정의**: Planning Poker 세션에서 선택 가능한 카드 값의 고정 배열. Fibonacci 수열 기반 7종과 특수 카드 2종으로 구성된다.
- **코드 표현**: `CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕']` (CardDeck.tsx 상수)
- **유사어·혼동 주의**: 카드 값은 모두 string 타입으로 저장됨. 숫자처럼 보이는 '1', '2' 등도 string이며 Number() 변환으로 숫자 확인
- **사용 위치**: CardDeck.tsx, PokerCard.tsx, average() 계산, 세션 완료 SP 합산
- **예시**: '13'은 중간 복잡도, '21'은 높은 복잡도, '?'는 추정 불가, '☕'는 휴식 요청

---

### CompletedTicket (완료된 티켓)
- **정의**: 호스트가 "다음 티켓"을 클릭하여 라운드가 완료된 티켓의 불변 레코드. 원본 티켓 정보, 참가자별 투표값 맵, Mode/Average 결과를 포함한다. 생성 후 변경되지 않는다.
- **코드 표현**: `CompletedTicket { ticket: JiraTicket; votes: Record<string, string>; result: { mode: string; average: number } }`
- **유사어·혼동 주의**: `JiraTicket`(투표 대상 원본 이슈)과 구별. CompletedTicket은 JiraTicket을 포함하며 투표 결과까지 담은 완성 레코드
- **사용 위치**: PokerState.completedTickets, SyncState.completedTickets, SessionSummary, TicketHistory
- **예시**: PROJ-42 티켓에서 참가자 3명이 5, 8, 8을 선택 → votes: {홍길동: '8', 김철수: '5', 이영희: '8'}, result: {mode: '8', average: 7.0}

---

### countdown (카운트다운)
- **정의**: 전원 투표 완료(allVoted=true) 후 카드 공개까지 남은 초. 2에서 시작하여 1초마다 감소하고 0이 되면 reveal이 실행된다.
- **코드 표현**: `countdown: number | null` (RoomPage 상태)
- **유사어·혼동 주의**: null은 카운트다운이 비활성 상태(투표 중 또는 공개 완료 후), 숫자(0-2)는 진행 중
- **사용 위치**: app/room/[roomId]/page.tsx, PokerTable(TableCenter)
- **예시**: 마지막 참가자 투표 시 → countdown=2 → 1초 후 1 → 1초 후 0 → reveal 실행

---

### customfield_10016 (스토리 포인트 필드)
- **정의**: Jira Cloud에서 Story Points 값을 저장하는 커스텀 필드의 ID. 이슈 조회 시 해당 필드를 읽어 기존 SP 값을 가져온다.
- **코드 표현**: `f.customfield_10016` (api/jira/route.ts), `JiraTicket.storyPoints`
- **유사어·혼동 주의**: Jira Server·DC에서는 customfield ID가 다를 수 있으나 이 프로젝트는 10016으로 고정
- **사용 위치**: app/api/jira/route.ts (이슈 조회 응답 매핑)
- **예시**: issue.fields.customfield_10016 = 5 → JiraTicket.storyPoints = 5

---

## D

### DataMessage (데이터 메시지)
- **정의**: WebRTC DataChannel 또는 서버 릴레이를 통해 피어 간 교환되는 실시간 이벤트 메시지. 타입 유니온으로 10가지 메시지 종류를 정의한다.
- **코드 표현**: `DataMessage` (hooks/useWebRTC.ts 타입 유니온)
- **유사어·혼동 주의**: SSE 이벤트(room_state, peer_joined 등)와 구별. SSE는 시그널링용, DataMessage는 게임 이벤트용
- **사용 위치**: useWebRTC.ts, handleDataMessage (RoomPage)
- **예시**: `{ type: 'voted', from: 'uuid' }` — 투표 완료 알림. `{ type: 'reveal', from: 'uuid', vote: '8' }` — 카드 공개

---

## E

### Epic (에픽)
- **정의**: Planning Poker 세션의 범위 단위. 하나의 Epic을 지정하면 그 하위 Story/Task/Bug 이슈들이 투표 대상으로 로드된다. 이 프로젝트에서 방은 항상 하나의 Epic에 대해 생성된다.
- **코드 표현**: `JiraEpic { id, key, summary }` (CreateRoomWizard 내부 타입), `epicKey` (파라미터)
- **유사어·혼동 주의**: `JiraTicket`(Epic 하위의 개별 이슈)과 구별. Epic은 컨테이너 역할로 직접 투표하지 않음. hierarchyLevel=1인 Jira 이슈 타입 (또는 이름이 'epic'/'에픽'/'큰틀')
- **사용 위치**: poker.방_생성_위저드 (Step 3), api/jira/route.ts (type='epic' 처리)
- **예시**: 'PROJ-100'이 Epic이면 그 하위의 PROJ-101, PROJ-102, PROJ-103이 투표 대상 JiraTicket

---

## H

### hasVoted (투표 완료 여부)
- **정의**: 특정 참가자가 현재 라운드에서 카드를 선택했는지 여부. true여도 실제 카드 값은 포함하지 않는다. reveal 전까지 다른 참가자는 선택 여부만 알 수 있다.
- **코드 표현**: `Participant.hasVoted: boolean`
- **유사어·혼동 주의**: `vote`(실제 카드 값)와 구별. hasVoted=true여도 vote는 reveal 후에야 설정됨. 투표 비공개 원칙의 핵심 구현
- **사용 위치**: Participant 엔티티, allVoted() 계산, 참가자 좌석 UI(체크 표시)
- **예시**: 참가자가 '8'을 선택하면 hasVoted=true, vote=undefined. reveal 후 vote='8'

---

### hostId (호스트 ID)
- **정의**: 현재 방의 호스트 역할을 가진 참가자의 myId. 방 생성 시 창설자의 myId가 초기값이며, 호스트 재접속 시 migrateHost()로 업데이트된다. 서버에는 저장되지 않는 클라이언트 전용 개념이다.
- **코드 표현**: `PokerState.hostId: string`, `SyncState.hostId`
- **유사어·혼동 주의**: `myId`(자신의 ID)와 구별. isHost()는 hostId === myId 비교로 판별. 서버(signalingStore)에는 hostId 개념 없음 — 클라이언트 전용
- **사용 위치**: PokerState, SyncState, isHost() 파생 함수, migrateHost() 액션
- **예시**: 방 생성자 myId='abc' → hostId='abc'. 호스트 재접속 후 새 myId='def' → migrateHost('def') → hostId='def'

---

## I

### isHost (호스트 여부)
- **정의**: 현재 접속자가 방의 호스트인지 여부를 반환하는 파생 함수. hostId === myId 비교 결과다.
- **코드 표현**: `isHost(): boolean` (PokerState 파생 함수)
- **유사어·혼동 주의**: 서버 측에는 이 개념이 없음. 클라이언트 Zustand 스토어에서만 관리되므로 sync_response 없이는 신규 참가자가 hostId를 모름
- **사용 위치**: RoomPage (Re-vote/Next/Kick/방종료 버튼 표시), beforeunload 핸들러, handleLeaveRoom
- **예시**: hostId='abc', myId='abc' → isHost()=true. hostId='abc', myId='xyz' → isHost()=false

---

### isLastTicket (마지막 티켓 여부)
- **정의**: 현재 진행 중인 티켓이 전체 목록의 마지막인지 여부를 반환하는 파생 함수. true이면 "다음 티켓" 버튼 대신 "완료" 표시가 나타난다.
- **코드 표현**: `isLastTicket(): boolean` (PokerState 파생 함수)
- **유사어·혼동 주의**: currentTicketIndex >= tickets.length - 1로 판별. 인덱스가 마지막이면 nextTicket 호출 후 세션 완료 화면으로 전환
- **사용 위치**: PokerTable(TableCenter), VoteResults, RoomPage
- **예시**: tickets.length=5, currentTicketIndex=4 → isLastTicket()=true → "All Done" 표시

---

## J

### JiraConfig (Jira 설정)
- **정의**: Jira API 호출에 필요한 인증 정보 묶음. 도메인, 토큰, Cloud 전용 이메일을 포함한다. 보안상 SyncState에 포함되지 않으므로 다른 참가자에게 공개되지 않는다.
- **코드 표현**: `JiraConfig { domain: string; token: string; email?: string }` (usePokerStore.ts)
- **유사어·혼동 주의**: `authMode`는 CreateRoomWizard의 로컬 상태이며 JiraConfig에 포함되지 않음. email 유무로 Cloud/Server 판별 가능
- **사용 위치**: PokerState.jiraConfig, CreateRoomWizard, api/jira/route.ts 헤더 처리
- **예시**: Cloud: `{domain: 'myorg.atlassian.net', token: 'ATATT...', email: 'me@org.com'}` / Server: `{domain: 'https://jira.corp.com', token: 'PAT...'}`

---

### JiraTicket (Jira 티켓)
- **정의**: 투표 대상이 되는 Jira 이슈. 방 생성 시 Epic 하위 이슈 조회 결과로 생성되며 이후 불변이다. key(이슈 키), summary(제목), storyPoints(기존 SP), description 등을 포함한다.
- **코드 표현**: `JiraTicket { id, key, summary, storyPoints?, description?, assignee?, reporter?, dueDate?, priority? }`
- **유사어·혼동 주의**: `CompletedTicket`(투표 결과를 포함한 완성 레코드)과 구별. JiraTicket은 투표 전/후 원본 이슈 정보만 포함
- **사용 위치**: PokerState.tickets, SyncState.tickets, CompletedTicket.ticket, TicketDetail
- **예시**: `{id: '12345', key: 'PROJ-42', summary: '로그인 화면 구현', storyPoints: 5}`

---

## M

### mode (최빈값)
- **정의**: 카드 공개 후 가장 많이 선택된 카드 값. 동점일 경우 먼저 집계된(투표 순서상 앞선) 값이 반환된다. '?', '☕'도 mode 계산에 포함된다.
- **코드 표현**: `mode(): string | null` (PokerState 파생 함수), `CompletedTicket.result.mode`
- **유사어·혼동 주의**: `average`(숫자 카드만 포함하는 평균)와 구별. mode는 모든 카드 타입 포함. mode='?'이면 SessionSummary의 총 SP 합산에서 0으로 처리
- **사용 위치**: PokerState.mode(), CompletedTicket.result.mode, SessionSummary, PokerTable(TableCenter)
- **예시**: 4명이 5, 8, 8, 13을 선택 → mode='8'. mode는 Planning Poker의 합의 대표값으로 Jira SP 기록에 사용됨

---

### myId (자신의 ID)
- **정의**: 세션 입장 시(createRoom 또는 joinRoom 호출 시) crypto.randomUUID()로 생성되는 UUID. 같은 방 내에서 고유하며 참가자 식별에 사용된다. 새로고침 후에도 sessionStorage 복원으로 유지된다.
- **코드 표현**: `PokerState.myId: string`
- **유사어·혼동 주의**: `hostId`(호스트 역할을 가진 참가자의 ID)와 구별. 호스트이면 myId === hostId. 재접속 시 새 myId가 생성되므로 호스트 재접속은 이름 매칭으로 판별
- **사용 위치**: PokerState, DataMessage.from 필드, Participant.id, isHost() 비교
- **예시**: 창설자: myId='a1b2...', hostId='a1b2...' → isHost()=true. 참가자: myId='c3d4...', hostId='a1b2...' → isHost()=false

---

### myVote (자신의 투표)
- **정의**: 현재 라운드에서 자신이 선택한 카드 값. null이면 아직 투표하지 않은 상태다. reveal 시 이 값이 다른 참가자에게 공개된다.
- **코드 표현**: `PokerState.myVote: string | null`
- **유사어·혼동 주의**: `Participant.vote`(공개된 카드 값, reveal 후 설정)와 구별. myVote는 reveal 전부터 존재하지만 외부에 공개되지 않음. reveal 시 myVote가 Participant.vote로 공개됨
- **사용 위치**: PokerState, CardDeck(선택 표시), RoomPage(reveal 브로드캐스트 시 사용)
- **예시**: 카드 '8' 선택 → myVote='8'. reveal 전 다른 참가자는 '8'을 모름. reveal 후 공개

---

## P

### phase (투표 단계)
- **정의**: 현재 라운드의 상태. 'voting'은 투표가 진행 중인 상태, 'revealed'는 모든 카드가 공개된 상태다.
- **코드 표현**: `PokerState.phase: 'voting' | 'revealed'`
- **유사어·혼동 주의**: TransportMode(연결 방식 상태)와 혼동 주의. phase는 게임 라운드 상태
- **사용 위치**: PokerState, SyncState, isAllVoted 조건, CardDeck(disabled 처리), VoteResults
- **예시**: voting → 전원 투표+2초 → revealed → Re-vote → voting 또는 → nextTicket → voting(새 티켓)

---

### Participant (참가자)
- **정의**: Planning Poker 세션에 참여 중인 단일 사용자의 식별 정보와 현재 라운드 투표 상태. 각 라운드마다 hasVoted와 vote가 초기화된다.
- **코드 표현**: `Participant { id: string; name: string; hasVoted: boolean; vote?: string }`
- **유사어·혼동 주의**: `myId`(자신)는 Participant.id 중 하나. 호스트도 일반 Participant로 목록에 포함됨
- **사용 위치**: PokerState.participants, SyncState.participants, PokerTable(좌석 배치)
- **예시**: `{id: 'abc', name: '홍길동', hasVoted: true, vote: undefined}` — 투표했으나 미공개 상태

---

### PokerState (포커 상태)
- **정의**: Planning Poker 세션 전체를 관리하는 Zustand 스토어. 방 정보, 참가자 목록, 투표 단계, 티켓 목록 등 모든 클라이언트 상태를 포함한다. sessionStorage에 persist되어 새로고침 후 복원 가능하다.
- **코드 표현**: `usePokerStore` (store/usePokerStore.ts), sessionStorage 키 'poker-room'
- **유사어·혼동 주의**: `SyncState`(P2P 동기화용 스냅샷)와 구별. PokerState는 전체 상태, SyncState는 동기화에 필요한 서브셋
- **사용 위치**: 모든 포커 관련 컴포넌트 및 훅
- **예시**: PokerState에는 jiraConfig 포함(민감 정보), SyncState에는 jiraConfig 미포함(보안)

---

## R

### relay (서버 릴레이)
- **정의**: WebRTC P2P 연결이 실패했을 때 서버를 경유하여 메시지를 전달하는 폴백 모드. 8초 타임아웃 후 자동으로 활성화된다. 활성화 후 세션 내에서는 P2P로 복귀하지 않는다.
- **코드 표현**: `TransportMode = 'relay'`, `relayModeRef.current = true`
- **유사어·혼동 주의**: P2P가 실패한 경우의 폴백 경로. broadcast/sendToPeer API는 동일하게 사용되므로 호출측 코드 변경 없음. 기업 방화벽(Zscaler, Symmetric NAT) 환경에서 주로 활성화됨
- **사용 위치**: useWebRTC.ts, PokerTable("서버 중계 모드" 배지 [transportMode 연결 미구현])
- **예시**: 회사 네트워크에서 WebRTC P2P가 차단된 경우 → 8초 후 relay 모드 → 게임 정상 진행

---

### roomId (방 ID)
- **정의**: 방 생성 시 crypto.randomUUID()로 생성되는 UUID. 초대 링크의 경로(`/room/{roomId}`)에 포함되어 다른 참가자가 접속할 수 있게 한다.
- **코드 표현**: `PokerState.roomId: string | null`, URL 경로 `/room/[roomId]`
- **유사어·혼동 주의**: `myId`(참가자 고유 ID)와 구별. roomId는 방 식별, myId는 참가자 식별
- **사용 위치**: PokerState, SSE 연결 URL, signalingStore, api/room/[roomId]
- **예시**: roomId='550e8400-e29b-41d4-a716-446655440000' → 초대 URL: `https://host/room/550e8400-...`

---

## S

### SyncState (동기화 상태)
- **정의**: 신규 참가자가 방에 합류할 때 기존 참가자로부터 받는 전체 게임 상태 스냅샷. sync_request/sync_response DataMessage의 페이로드다. JiraConfig는 보안상 제외된다.
- **코드 표현**: `SyncState { participants, tickets, currentTicketIndex, phase, completedTickets, hostId }`
- **유사어·혼동 주의**: `PokerState`(전체 클라이언트 상태)의 서브셋. SyncState는 보안상 jiraConfig 제외. 신규 참가자는 SyncState를 받아 applySyncState()로 상태를 동기화
- **사용 위치**: DataMessage(sync_response), applySyncState(), useWebRTC(sync_request/response 처리)
- **예시**: 3번째 참가자가 입장 → sync_request 발신 → 기존 참가자가 현재 game state 스냅샷을 SyncState로 전달

---

## T

### TransportMode (전송 방식)
- **정의**: WebRTC 연결의 현재 상태를 나타내는 값. 'connecting'은 연결 수립 시도 중, 'p2p'는 직접 P2P 연결 성공, 'relay'는 서버 릴레이 모드. p2p 또는 relay로 한 번 전환되면 connecting으로 돌아가지 않는다.
- **코드 표현**: `TransportMode: 'connecting' | 'p2p' | 'relay'` (useWebRTC.ts)
- **유사어·혼동 주의**: `phase`(게임 라운드 상태)와 혼동 주의. TransportMode는 네트워크 연결 방식
- **사용 위치**: useWebRTC.ts (transportMode 상태), PokerTable([transportMode 전달 연결 미구현])
- **예시**: 방 생성 → connecting. 첫 피어와 DataChannel 열림 → p2p. 8초 내 DataChannel 미열림 → relay
