# Jira Joker

WebRTC P2P 기반 실시간 Planning Poker. Jira Epic의 하위 티켓을 순차적으로 스토리 포인트 산정.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Zustand 5 (persist middleware, sessionStorage)
- WebRTC DataChannel (Full Mesh P2P)
- SSE (Server-Sent Events) signaling
- Tailwind CSS v4
- `@/*` path alias → project root

## File Map

```
app/
  page.tsx                          # Home → <CreateRoomWizard />
  layout.tsx                        # Root layout (Geist fonts)
  globals.css                       # Tailwind base
  api/
    jira/route.ts                   # Jira REST proxy (GET: myself/epic/issues)
    signaling/[roomId]/route.ts     # SSE GET (signaling stream) + POST (relay)
    room/[roomId]/route.ts          # Room existence check (GET → { exists })
  room/[roomId]/page.tsx            # Poker room (WebRTC, game loop, PokerTable + TicketPanel + CardDeck)

components/poker/
  CreateRoomWizard.tsx              # 3-step wizard (Jira auth → nickname → epic)
  JoinRoomForm.tsx                  # Link-joiner entry (name input)
  CardDeck.tsx                      # Card row, CARD_VALUES export
  PokerCard.tsx                     # Single card (value, selected, revealed states)
  PokerTable.tsx                    # Circular poker table (elliptical seating + blue table + center results/controls)
  TicketPanel.tsx                   # Right-side floating panel (w-96, toggle, TicketDetail + TicketHistory)
  TicketDetail.tsx                  # Simplified ticket info (key, progress, summary, description)
  TicketHistory.tsx                 # Completed tickets accordion
  SessionSummary.tsx                # Session end summary (completed tickets table + total SP)
  PlayerList.tsx                    # (미사용, PokerTable로 대체)
  VoteResults.tsx                   # (미사용, PokerTable 내부 TableCenter로 대체)

hooks/
  useWebRTC.ts                      # SSE signaling + RTCPeerConnection mesh

lib/
  signalingStore.ts                 # In-memory room→peers SSE controller map

store/
  usePokerStore.ts                  # Zustand store (state + actions + derived)
  useHydration.ts                   # SSR hydration guard hook
```

## State (Zustand)

### Fields

| Field | Type | 설명 |
|---|---|---|
| `roomId` | `string \| null` | 방 UUID |
| `myId` | `string` | 내 UUID |
| `myName` | `string \| null` | 내 닉네임 |
| `hostId` | `string` | 방장 UUID (createRoom 시 myId로 설정) |
| `jiraConfig` | `JiraConfig \| null` | Jira 인증 (방장만 보유, 게스트는 null) |
| `tickets` | `JiraTicket[]` | 투표 대상 티켓 목록 |
| `currentTicketIndex` | `number` | 현재 티켓 인덱스 |
| `phase` | `'voting' \| 'revealed'` | 현재 단계 |
| `myVote` | `string \| null` | 내 선택 카드 |
| `participants` | `Participant[]` | `{id, name, hasVoted, vote?}` |
| `completedTickets` | `CompletedTicket[]` | 완료 티켓+투표+결과 이력 |

### Actions

| Action | 동작 |
|---|---|
| `createRoom(name, jiraConfig, tickets)` | UUID 생성, hostId=myId, 방 초기화, roomId 반환 |
| `joinRoom(name, roomId)` | UUID 생성, 자신을 participants에 추가 (hostId는 sync_response로 수신) |
| `leaveRoom()` | initialState 복원 + sessionStorage 삭제 |
| `selectCard(value)` | myVote 설정, 자신 hasVoted=true |
| `revealVotes()` | phase→revealed, 자신의 vote 필드에 myVote 복사 |
| `resetRound()` | phase→voting, myVote=null, **모든** participants hasVoted=false, vote 제거 |
| `nextTicket()` | completedTickets에 현재 결과 기록, index++, 투표 상태 초기화 |
| `addParticipant(p)` | 중복 체크 후 추가 |
| `removeParticipant(id)` | participants에서 제거 |
| `setParticipantVoted(id)` | 해당 참가자 hasVoted=true |
| `setParticipantVote(id, vote)` | hasVoted=true + vote 값 설정 |
| `applySyncState(syncState)` | 자신의 participant는 보존하면서 나머지 동기화 (hostId 포함) |

### Derived Getters

| Getter | 반환값 |
|---|---|
| `isHost()` | `hostId === myId` |
| `allVoted()` | 모든 참가자 hasVoted && length > 0 |
| `mode()` | 최빈값 (빈도 동률 시 먼저 등장한 값) |
| `average()` | 숫자 투표만의 평균 (`?`, `☕` 제외), 없으면 null |
| `currentTicket()` | `tickets[currentTicketIndex]` or null |
| `isLastTicket()` | `currentTicketIndex >= tickets.length - 1` |

### SyncState (P2P 전송 구조)

```typescript
interface SyncState {
  participants: Participant[]
  tickets: JiraTicket[]
  currentTicketIndex: number
  phase: 'voting' | 'revealed'
  completedTickets: CompletedTicket[]
  hostId: string
}
```

### Persistence

- sessionStorage key: `poker-room`
- partialize 대상: roomId, myId, myName, hostId, jiraConfig, tickets, phase, myVote, participants, currentTicketIndex, completedTickets
- `useHydration()` hook으로 SSR hydration mismatch 방지

## WebRTC P2P

### DataMessage Types

| type | payload | 발신 시점 |
|---|---|---|
| `voted` | `{ from }` | 카드 선택 시 전체 broadcast |
| `reveal` | `{ from, vote }` | 카운트다운 완료 후 전체 broadcast |
| `reset` | — | 호스트가 Re-vote 클릭 시 broadcast |
| `next` | — | 호스트가 Next Ticket 클릭 시 broadcast |
| `sync_request` | `{ from }` | DataChannel open 시 새 피어가 전송 |
| `sync_response` | `{ state: SyncState }` | sync_request 수신한 기존 피어가 응답 |
| `room_closed` | — | 호스트 능동 이탈 시 전체 broadcast → 참가자 세션 정리 |
| `kick` | `{ targetId }` | 호스트가 특정 참가자 추방 시 broadcast |
| `host_migrated` | `{ newHostId }` | 호스트 재접속 시 hostId 복원 broadcast |

### Connection Flow

1. SSE 연결: `GET /api/signaling/[roomId]?peerId=...&name=...`
2. `room_state` 이벤트로 기존 피어 목록 수신
3. 각 기존 피어에 대해 RTCPeerConnection 생성 (initiator = 새 피어)
4. SDP offer/answer + ICE candidate를 POST `/api/signaling/[roomId]`로 릴레이
5. DataChannel open → `sync_request` 전송 → `sync_response`로 상태 동기화
6. SSE `peer_left` → RTCPeerConnection close + participants에서 제거

### RTC Config

```typescript
{ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
```

## Signaling Server

### SSE (GET)

- 30초 heartbeat
- 이벤트: `room_state`, `peer_joined`, `offer`, `answer`, `ice_candidate`, `peer_left`
- abort 시 자동 `peer_left` broadcast + 룸에서 제거

### Relay (POST)

```typescript
{ from: string, to?: string, type: string, payload: unknown }
```
- `to` 지정: 특정 피어에게만 전송
- `to` 미지정: 발신자 제외 전체 broadcast
- 응답: 204

### signalingStore (lib)

- `rooms: Map<roomId, Map<peerId, PeerEntry>>` (module-level singleton)
- `addPeer`, `removePeer`, `sendToPeer`, `broadcast`, `getExistingPeers`

## API Proxy (`/api/jira`)

### Authentication

| 모드 | Authorization 헤더 | API 버전 | email 필요 |
|---|---|---|---|
| Cloud | `Basic base64(email:token)` | `/rest/api/3` | O |
| Server/DC | `Bearer token` | `/rest/api/2` | X |

### Request Headers (Client → Proxy)

```
x-jira-domain: your-org.atlassian.net (또는 https://jira.company.com)
x-jira-email: user@example.com  (Cloud만)
x-jira-token: API token
```

### Endpoints

| type param | 용도 | 추가 param | 반환 |
|---|---|---|---|
| `myself` | 인증 검증 | — | `{ displayName }` |
| `epic` | Epic 조회 | `epicKey` | `{ epic: { id, key, summary } }` |
| `issues` | Epic 하위 이슈 | `epicKey` | `{ issues: JiraTicket[] }` |

### Jira Custom Fields

- `customfield_10016` = Story Points (Cloud)

### 인증 보안

- 토큰은 서버 proxy에서만 사용, Jira에 직접 전달
- 서버에 토큰 저장 없음 (요청당 ephemeral)
- WebRTC P2P로 토큰 전송 없음 (게스트는 jiraConfig 접근 불가)
- sessionStorage에 jiraConfig 저장 (브라우저 탭 종료 시 소멸)

## Game Flow

### 방장 경로

```
CreateRoomWizard (Step1: Jira 인증 → Step2: 닉네임 → Step3: Epic 선택)
  → createRoom() → /room/[roomId]
  → 2인 미만: 대기 화면 (초대 링크 복사)
  → 2인 이상: 게임 시작
  → 카드 선택 → broadcast 'voted'
  → 전원 투표 완료 → 2초 카운트다운 → revealVotes() + broadcast 'reveal'
  → Re-vote (broadcast 'reset') 또는 Next (broadcast 'next')
```

### 참가자 경로

```
/room/[roomId] → JoinRoomForm (닉네임 입력)
  → joinRoom() → WebRTC 연결
  → sync_request → sync_response로 상태 수신 (hostId 포함)
  → 카드 선택 → broadcast 'voted'
  → 전원 투표 완료 → 자동 reveal
  → Re-vote/Next 버튼 비활성 (호스트만 가능)
```

### 나가기

- **호스트:** "나가기" 클릭 → `room_closed` broadcast → `leaveRoom()` → `router.push('/')`
- **참가자:** `room_closed` 수신 시 `leaveRoom()` 호출 → sessionStorage 정리 → "호스트가 방을 종료했습니다" overlay 표시
- **일반 참가자 이탈:** 헤더 "나가기" → `leaveRoom()` → `router.push('/')` → SSE abort → `peer_left` broadcast

### Room Management

- **호스트 이탈 보호:** 호스트 SSE 끊김 시 즉시 종료하지 않고 "호스트 재접속 대기 중" 오버레이 표시. 호스트가 같은 이름으로 재접속하면 `host_migrated` broadcast로 hostId 자동 복원
- **beforeunload:** 호스트 탭 닫기 시 확인 대화상자 표시 (실수 방지)
- **호스트 Kick:** 호스트가 `kick` 메시지 broadcast → 대상에게 추방 overlay 표시, 나머지 참가자 목록에서 제거
- **참가자 0명 시 방 종료:** 모든 참가자 이탈 시에만 서버 측 room 정리

## UI 구조

### Room Header (3영역)

- 좌측: "Jira Joker" 타이틀
- 중앙: roomId 축약(8자) + "링크 복사" 버튼
- 우측: 유저 아바타(이니셜) + 이름 + "나가기" 버튼

### Poker Table (중앙)

- **테이블:** blue 그라데이션 (`from-blue-600 to-blue-700`) 타원형 테이블
- **좌석 배치:** 참가자를 타원 위에 배치. "나(Me)"는 항상 하단 중앙, 나머지 시계 방향
- **Host 표시:** 호스트 아바타에 ★ 노란색 뱃지 (`bg-yellow-400`)
- **TableCenter:** 테이블 중앙에 투표 상태 / 카운트다운 / 결과(Mode·Avg) 표시
  - 호스트 전용 컨트롤: "Re-vote" + "Next →" (마지막 티켓 시 "All Done")
  - 비호스트: "호스트만 진행 가능" 안내

### Ticket Panel (우측 float)

- **너비:** `w-96` (384px), 우측 고정
- **토글:** 항상 보이는 토글 버튼 (열림 시 chevron-right, 닫힘 시 document icon)
- **슬라이드:** `translate-x` 기반 애니메이션 (열림: `translate-x-0`, 닫힘: `translate-x-full`)
- **동적 중앙 정렬:** 패널 열림 시 메인 콘텐츠에 `lg:pr-96` 적용 → 테이블·카드덱 자동 재중앙화
- **내용:** TicketDetail (key + progress + summary + description) + TicketHistory
- **모바일:** `bg-black/20` backdrop overlay (lg 이상에서는 숨김)

### Card Deck (sticky bottom)

- Fibonacci 카드 하단 고정
- 티켓 활성화 시에만 표시
- 패널 열림 시 `lg:pr-96` 연동하여 중앙 정렬 유지

### Auto-Reveal 조건

```
phase === 'voting' && participants.length >= 2 && participants.every(p => p.hasVoted)
```

- Effect 1: 조건 충족 시 countdown=2 → interval로 1씩 감소 → 0 도달
- Effect 2: countdown===0 감지 → revealVotes() + broadcast reveal + countdown=null
- 표시 조건: `countdown !== null && countdown > 0`

## Constants

```typescript
CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕']  // CardDeck.tsx
JIRA_CREDS_KEY = 'jira-joker-credentials'                        // CreateRoomWizard.tsx (localStorage)
'poker-room'                                                      // sessionStorage key (Zustand persist)
```

## Jira Credential Caching

- localStorage key: `jira-joker-credentials`
- 저장 시점: Step 1 인증 성공 후
- 저장 내용: `{ authMode, domain, email, token }`
- 로드 시점: CreateRoomWizard 마운트 시 useEffect
- 삭제: "저장된 인증 정보 삭제" 버튼 (hasSavedCreds일 때만 표시)
