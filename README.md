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
  room/[roomId]/page.tsx            # Poker room (WebRTC, game loop, header)

components/poker/
  CreateRoomWizard.tsx              # 3-step wizard (Jira auth → nickname → epic)
  JoinRoomForm.tsx                  # Link-joiner entry (name input)
  CardDeck.tsx                      # Card row, CARD_VALUES export
  PokerCard.tsx                     # Single card (value, selected, revealed states)
  PlayerList.tsx                    # Participant avatars + vote badges + host star
  VoteResults.tsx                   # Mode/Average + Re-vote/Next (host-only)
  TicketDetail.tsx                  # Current ticket info (desc, assignee, priority)
  TicketHistory.tsx                 # Completed tickets accordion

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

- 헤더 "나가기" 버튼 → `leaveRoom()` → `router.push('/')` → SSE abort → `peer_left` broadcast

## UI 구조

### Room Header (3영역)

- 좌측: "Jira Joker" 타이틀
- 중앙: roomId 축약(8자) + "링크 복사" 버튼
- 우측: 유저 아바타(이니셜) + 이름 + "나가기" 버튼

### Host 표시

- PlayerList: 호스트 아바타에 ★ 뱃지
- VoteResults: 비호스트에게 "호스트만 다음 단계를 진행할 수 있습니다" 안내 + 버튼 disabled

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
