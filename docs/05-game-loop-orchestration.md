# Chapter 05: 게임 루프와 UI 상태 오케스트레이션

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app/room/[roomId]/page.tsx` | 게임 룸 페이지 — 전체 오케스트레이션 |
| `components/poker/PlayerList.tsx` | 참가자 목록 + 투표 상태 뱃지 + Kick 버튼 |
| `components/poker/VoteResults.tsx` | 투표 결과 (Mode/Average) + Reset/Next 컨트롤 |
| `components/poker/CardDeck.tsx` | 카드 덱 UI + 선택 핸들링 |

---

## 1. 전체 게임 흐름

Planning Poker의 상태 머신:

```
┌──────────┐    createRoom()    ┌──────────────┐    2명 이상 접속    ┌─────────┐
│ 방 생성   │──────────────────→│ 대기 (<2인)   │──────────────────→│ voting  │
└──────────┘                    └──────────────┘                    └────┬────┘
                                                                        │
                                                   전원 투표 완료        │
                                                   2초 카운트다운        │
                                                                        ▼
                                                                   ┌─────────┐
                                                    Reset          │revealed │
                                              ┌───────────────────│         │
                                              │                    └────┬────┘
                                              ▼                         │
                                         ┌─────────┐     Next Ticket   │
                                         │ voting  │←──────────────────┘
                                         └────┬────┘
                                              │     마지막 티켓이면
                                              ▼
                                    ┌────────────────────┐
                                    │ All Tickets Done   │
                                    └────────────────────┘
```

- **voting:** 카드 선택 가능, 다른 참가자의 선택은 숨김 (완료 여부만 표시)
- **revealed:** 모든 투표값 공개, Mode/Average 계산, Reset/Next 버튼 활성화
- **phase 전환은 호스트만** 가능 (Reset, Next Ticket)

---

## 2. Room Page 조건부 렌더링 체계

`app/room/[roomId]/page.tsx`는 여러 상태에 따라 다른 UI를 반환한다. **early return 체인**으로 구성되며 위에서부터 순서대로 평가된다:

```
1. !hydrated                          → 로딩 (L231-237)
   │
2. !myName || storeRoomId !== roomId  → 분기:
   │   ├── roomValid === null         → 로딩 (L240-246)
   │   ├── roomValid === false        → not-found UI (L247-262)
   │   └── roomValid === true         → JoinRoomForm (L263)
   │
3. disconnectReason !== null          → 종료/추방 overlay (L267-287)
   │
4. participants.length < 2            → 대기 화면 + 초대 링크 (L292-317)
   │
5. (default)                          → 게임 UI (L320-402)
```

### early return 패턴의 장점

각 조건을 독립적으로 처리하여 중첩 if-else를 피한다. 새로운 조건(예: "네트워크 오류 화면")을 추가할 때 체인의 적절한 위치에 삽입하면 된다.

### 방 유효성 검사 (L71-81)

```ts
// app/room/[roomId]/page.tsx:71-81
useEffect(() => {
  if (!hydrated) return
  if (myName && storeRoomId === roomId) {
    setRoomValid(true)
    return
  }
  fetch(`/api/room/${roomId}`)
    .then((res) => res.json())
    .then((data: { exists: boolean }) => setRoomValid(data.exists))
    .catch(() => setRoomValid(false))
}, [hydrated, myName, storeRoomId, roomId])
```

이미 방에 참여 중인 사용자(`myName` 존재 + `storeRoomId` 일치)는 서버 확인을 건너뛴다. 새 참가자만 `/api/room/[roomId]`로 방 존재 여부를 확인한다.

---

## 3. 투표 → 자동 Reveal 2-Effect 패턴

모든 참가자가 투표를 완료하면 2초 카운트다운 후 자동으로 결과가 공개된다. 이 로직을 **두 개의 분리된 Effect**로 구현한다.

### Effect 1: 카운트다운 타이머 관리 (L162-178)

```ts
// app/room/[roomId]/page.tsx:83-86, 162-178
const isAllVoted =
  phase === 'voting' &&
  participants.length >= 2 &&
  participants.every((p) => p.hasVoted)

// Effect 1: 카운트다운 타이머만 관리
useEffect(() => {
  if (!isAllVoted) {
    setCountdown(null)
    return
  }
  setCountdown(2)
  const interval = setInterval(() => {
    setCountdown((prev) => {
      if (prev === null || prev <= 1) {
        clearInterval(interval)
        return 0
      }
      return prev - 1
    })
  }, 1000)
  return () => clearInterval(interval)
}, [isAllVoted])
```

`isAllVoted`가 `true`가 되면 카운트다운을 시작한다. 1초마다 감소하여 0에 도달하면 interval을 정지한다. 투표가 취소되면(`isAllVoted` → `false`) cleanup으로 interval을 정리하고 countdown을 null로 리셋한다.

### Effect 2: countdown === 0 감지 → reveal 실행 (L181-187)

```ts
// app/room/[roomId]/page.tsx:181-187
useEffect(() => {
  if (countdown === 0) {
    revealVotes()
    broadcastRef.current({ type: 'reveal', from: myId, vote: myVoteRef.current ?? '?' })
    setCountdown(null)
  }
}, [countdown, revealVotes, myId])
```

**왜 Effect를 분리하는가?**

하나의 Effect에서 `setCountdown(0)`과 `revealVotes()`를 동시에 실행하면 React의 **"Cannot update a component while rendering a different component"** 경고가 발생할 수 있다. `setInterval` 콜백 안에서 다른 컴포넌트의 상태를 직접 변경하는 것이 문제다.

분리하면:
- Effect 1: countdown 값만 관리 (자체 상태 업데이트)
- Effect 2: countdown 값 변경을 **감지**하여 reveal 실행 (React의 정상 렌더 사이클)

이 패턴은 **"상태 변경 감지 → 부수효과 실행"**이라는 React의 표준 Effect 패턴을 따른다.

---

## 4. 호스트 전용 컨트롤

게임 진행(Reset, Next, Kick)은 호스트만 수행할 수 있다. 각 액션은 **broadcast + 로컬 상태 업데이트** 패턴을 따른다.

### Reset (L197-200)

```ts
// app/room/[roomId]/page.tsx:197-200
const handleReset = useCallback(() => {
  resetRound()
  broadcastRef.current({ type: 'reset' })
}, [resetRound])
```

### Next Ticket (L202-205)

```ts
// app/room/[roomId]/page.tsx:202-205
const handleNext = useCallback(() => {
  nextTicket()
  broadcastRef.current({ type: 'next' })
}, [nextTicket])
```

### Kick (L207-210)

```ts
// app/room/[roomId]/page.tsx:207-210
const handleKick = useCallback((targetId: string) => {
  broadcastRef.current({ type: 'kick', targetId })
  removeParticipant(targetId)
}, [removeParticipant])
```

**공통 패턴:** 로컬 상태를 먼저 업데이트하고, 동시에 DataChannel로 broadcast하여 다른 참가자에게 알린다. 로컬 업데이트가 먼저이므로 호스트의 UI가 즉시 반응하고, 네트워크 지연과 무관하게 responsive한 UX를 제공한다.

### VoteResults 컴포넌트에서의 호스트 구분

```ts
// components/poker/VoteResults.tsx:45-47
{!isHost && (
  <p className="text-center text-xs text-gray-400">호스트만 다음 단계를 진행할 수 있습니다</p>
)}
```

비호스트에게는 안내 메시지를 표시하고, Reset/Next 버튼에 `disabled={!isHost}`를 설정하여 조작을 방지한다.

### PlayerList에서의 Kick 버튼

```ts
// components/poker/PlayerList.tsx:43-54
{isHost && onKick && participant.id !== myId && (
  <button
    onClick={() => onKick(participant.id)}
    className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
    title="추방"
  >
    {/* X 아이콘 SVG */}
  </button>
)}
```

Kick 버튼은 세 가지 조건을 모두 만족할 때만 표시된다:
- `isHost` — 호스트인 경우
- `onKick` — 핸들러가 전달된 경우
- `participant.id !== myId` — 자기 자신이 아닌 경우

---

## 5. 방 관리 (Room Lifecycle)

### 5.1 방 유효성 검사

```
새 참가자 접속 → GET /api/room/[roomId] → { exists: boolean }
                  ↓
              roomExists(roomId)    ← signalingStore의 rooms Map 조회
                  ↓
        true → JoinRoomForm 표시
        false → "방을 찾을 수 없습니다" UI
```

`signalingStore`의 `rooms` Map에 해당 roomId가 존재하는지 확인한다. 호스트가 SSE를 연결해야 방이 생성되므로, 아무도 접속하지 않은 URL은 `exists: false`를 반환한다.

### 5.2 호스트 이탈 시 방 종료

**정상 이탈 (나가기 버튼 클릭):**

```ts
// app/room/[roomId]/page.tsx:212-218
const handleLeaveRoom = useCallback(() => {
  if (usePokerStore.getState().isHost()) {
    broadcastRef.current({ type: 'room_closed' })
  }
  leaveRoom()
  router.push('/')
}, [leaveRoom, router])
```

호스트가 나가기 버튼을 클릭하면 `room_closed`를 broadcast한 후 방을 떠난다.

**비정상 이탈 (탭 종료, 네트워크 끊김):**

```ts
// app/room/[roomId]/page.tsx:149-154
onPeerDisconnected: (peerId) => {
  removeParticipant(peerId)
  if (peerId === usePokerStore.getState().hostId) {
    setDisconnectReason('host_left')
  }
},
```

탭 종료 시 `room_closed` 메시지를 보낼 수 없다. 대신 SSE abort → `peer_left` → `onPeerDisconnected` 콜백이 호출되고, 이탈한 피어의 ID가 `hostId`와 일치하면 방 종료로 처리한다.

### 5.3 Kick 처리

```ts
// app/room/[roomId]/page.tsx:129-135 (handleDataMessage 내부)
case 'kick':
  if (msg.targetId === usePokerStore.getState().myId) {
    setDisconnectReason('kicked')
  } else {
    removeParticipant(msg.targetId)
  }
  break
```

`kick` 메시지를 수신한 참가자가 자기 자신이 대상이면 추방 overlay를 표시하고, 그렇지 않으면 해당 참가자를 목록에서 제거한다.

### 종료/추방 overlay

```ts
// app/room/[roomId]/page.tsx:267-287
if (disconnectReason) {
  const title = disconnectReason === 'host_left' ? '방이 종료되었습니다' : '방에서 추방되었습니다'
  const desc = disconnectReason === 'host_left' ? '호스트가 방을 나갔습니다.' : '호스트에 의해 추방되었습니다.'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* overlay 내용 */}
    </div>
  )
}
```

`disconnectReason` 값에 따라 적절한 메시지를 표시하고, "홈으로 돌아가기" 버튼으로 방을 떠날 수 있다.

---

## 6. `handleDataMessage` 메시지 라우팅

DataChannel에서 수신된 모든 메시지는 `handleDataMessage`의 switch문으로 라우팅된다:

```ts
// app/room/[roomId]/page.tsx:93-139
const handleDataMessage = useCallback(
  (msg: DataMessage) => {
    switch (msg.type) {
      case 'voted':
        setParticipantVoted(msg.from)
        break
      case 'reveal':
        setParticipantVote(msg.from, msg.vote)
        break
      case 'reset':
        resetRound()
        break
      case 'next':
        nextTicket()
        break
      case 'sync_request': {
        const s = storeRef.current
        sendToPeerRef.current(msg.from, {
          type: 'sync_response',
          state: {
            participants: s.participants,
            tickets: s.tickets,
            currentTicketIndex: s.currentTicketIndex,
            phase: s.phase,
            completedTickets: s.completedTickets,
            hostId: s.hostId,
          },
        })
        break
      }
      case 'sync_response':
        applySyncState(msg.state)
        break
      case 'room_closed':
        setDisconnectReason('host_left')
        break
      case 'kick':
        if (msg.targetId === usePokerStore.getState().myId) {
          setDisconnectReason('kicked')
        } else {
          removeParticipant(msg.targetId)
        }
        break
    }
  },
  [setParticipantVoted, setParticipantVote, resetRound, nextTicket, applySyncState, removeParticipant],
)
```

**각 case의 상태 업데이트 흐름:**

| 메시지 타입 | 상태 업데이트 | 결과 |
|-------------|--------------|------|
| `voted` | `setParticipantVoted(from)` → 해당 참가자의 `hasVoted = true` | PlayerList에 체크 표시 |
| `reveal` | `setParticipantVote(from, vote)` → vote값 저장 + `hasVoted = true` | 카드 값 공개 |
| `reset` | `resetRound()` → phase='voting', 모든 투표 초기화 | 새 라운드 시작 |
| `next` | `nextTicket()` → 현재 결과 저장, 다음 티켓으로 이동 | 새 티켓 투표 |
| `sync_request` | `storeRef.current` → 현재 상태를 `sync_response`로 회신 | 신규 피어에게 상태 전달 |
| `sync_response` | `applySyncState(state)` → 원격 상태 병합 | 게임 상태 동기화 |
| `room_closed` | `setDisconnectReason('host_left')` | 종료 overlay 표시 |
| `kick` | 대상이면 overlay, 아니면 `removeParticipant` | 추방 처리 |

**`sync_request`에서 `storeRef` 사용 이유:**

```ts
const s = storeRef.current
sendToPeerRef.current(msg.from, { type: 'sync_response', state: { ... } })
```

`handleDataMessage`는 `useCallback`으로 래핑되어 있으므로 클로저에 캡처된 상태가 오래될 수 있다. `storeRef`는 항상 최신 상태를 참조하므로 sync_response에 정확한 현재 상태가 포함된다. 마찬가지로 `sendToPeerRef`도 WebRTC 연결 상태와 무관하게 최신 함수를 참조한다.

---

## Key Takeaways

- **Early return 체인**으로 복잡한 조건부 렌더링을 단순화 — 각 조건이 독립적이고 읽기 쉽다
- **2-Effect 패턴**으로 카운트다운과 reveal을 분리 — React setState 경고 방지 + 단일 책임 원칙
- **broadcast + 로컬 업데이트** 이중 실행 패턴 — 호스트 UI의 즉시 반응성 확보
- **호스트 이탈 이중 감지** — 정상 이탈(`room_closed`) + 비정상 이탈(`onPeerDisconnected` hostId 비교)
- **Ref 기반 최신 상태 참조** — useCallback/useEffect의 stale closure 문제를 방지하는 필수 패턴
