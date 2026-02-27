# Chapter 03: Zustand 상태 관리 심화

## 관련 파일

| 파일 | 역할 |
|------|------|
| `store/usePokerStore.ts` | 전역 상태 스토어 — state, actions, derived 함수 통합 |
| `store/useHydration.ts` | SSR hydration 완료 감지 훅 |

---

## 1. `create<T>()()` 더블 괄호 패턴

Zustand 스토어 생성 시 이중 함수 호출이 사용된다:

```ts
// store/usePokerStore.ts:93-95
export const usePokerStore = create<PokerState>()(
  persist(
    (set, get) => ({
```

**왜 괄호가 두 개인가?**

```
create<PokerState>()     ← 제네릭 타입 추론 전용 호출 (curried)
                    (    ← 실제 스토어 정의 (middleware 포함)
  persist(...)
)
```

TypeScript에서 제네릭 타입을 명시하면서 동시에 middleware를 적용하려면 curried 형태가 필요하다. `create<T>()`가 타입을 확정하고, 두 번째 `()`에서 `persist`, `devtools` 등 middleware를 체이닝한다.

middleware 없이 사용할 때는 단일 괄호로도 가능하다:
```ts
// middleware 없는 경우
const useStore = create<State>((set) => ({ ... }))
```

---

## 2. State + Actions + Derived 단일 스토어 통합

Zustand는 state, actions, derived(파생 함수)를 하나의 객체에서 관리한다. Redux의 reducer/action 분리와 달리 하나의 `create()` 안에 모든 것이 들어간다.

### 2.1 `set()` 콜백 패턴 — 이전 상태 참조

```ts
// store/usePokerStore.ts:134-140
selectCard: (value) =>
  set((state) => ({
    myVote: value,
    participants: state.participants.map((p) =>
      p.id === state.myId ? { ...p, hasVoted: true } : p,
    ),
  })),
```

`set()`에 **콜백 함수**를 전달하면 현재 상태(`state`)를 인자로 받는다. 이전 상태에 기반한 업데이트가 필요할 때 사용한다. 여기서는 `state.myId`와 `state.participants`를 참조하여 자신의 투표 상태를 업데이트한다.

단순 값 설정은 객체를 직접 전달한다:
```ts
// store/usePokerStore.ts:130
set(initialState)
```

### 2.2 `get()` 스냅샷 패턴 — 복잡한 로직에서 현재 상태 읽기

```ts
// store/usePokerStore.ts:161-188
nextTicket: () => {
  const state = get()
  const ticket = state.tickets[state.currentTicketIndex]
  if (!ticket) return

  const votes: Record<string, string> = {}
  for (const p of state.participants) {
    if (p.vote) votes[p.name] = p.vote
  }

  const modeValue = state.mode() ?? '?'
  const avgValue = state.average() ?? 0

  set({
    currentTicketIndex: state.currentTicketIndex + 1,
    completedTickets: [
      ...state.completedTickets,
      { ticket, votes, result: { mode: modeValue, average: avgValue } },
    ],
    phase: 'voting',
    myVote: null,
    participants: state.participants.map((p) => ({
      id: p.id,
      name: p.name,
      hasVoted: false,
    })),
  })
},
```

`get()`은 호출 시점의 **전체 상태 스냅샷**을 반환한다. `set()` 콜백과 달리 함수 시작 부분에서 먼저 상태를 읽고, 조건 분기나 파생값 계산을 한 뒤, 마지막에 `set()`으로 업데이트하는 패턴이다.

**`set()` 콜백 vs `get()` 사용 기준:**
- `set((state) => ...)` — 단순 상태 변환 (map, filter 등)
- `get()` + `set({...})` — 여러 상태를 조합하거나 조건 분기가 필요한 복잡한 로직

### 2.3 파생 함수

```ts
// store/usePokerStore.ts:237-240
isHost: () => {
  const { hostId, myId } = get()
  return hostId === myId
},

// store/usePokerStore.ts:247-263
mode: () => {
  const votes = get()
    .participants.filter((p) => p.vote !== undefined)
    .map((p) => p.vote!)
  if (votes.length === 0) return null
  const freq: Record<string, number> = {}
  let maxCount = 0
  let modeValue: string | null = null
  for (const v of votes) {
    freq[v] = (freq[v] ?? 0) + 1
    if (freq[v] > maxCount) {
      maxCount = freq[v]
      modeValue = v
    }
  }
  return modeValue
},

// store/usePokerStore.ts:273-276
currentTicket: () => {
  const { tickets, currentTicketIndex } = get()
  return tickets[currentTicketIndex] ?? null
},
```

Zustand에서 파생값은 **함수로 정의**한다. Redux의 `selector`와 달리 스토어 내부에서 `get()`으로 직접 상태를 읽는다. 호출 시점의 최신 상태를 반환하므로 별도 memoization 없이도 정확한 값을 제공한다.

---

## 3. `persist` middleware + `sessionStorage`

### 3.1 설정

```ts
// store/usePokerStore.ts:283-300
{
  name: 'poker-room',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    roomId: state.roomId,
    myId: state.myId,
    myName: state.myName,
    hostId: state.hostId,
    jiraConfig: state.jiraConfig,
    tickets: state.tickets,
    phase: state.phase,
    myVote: state.myVote,
    participants: state.participants,
    currentTicketIndex: state.currentTicketIndex,
    completedTickets: state.completedTickets,
  }),
},
```

- **`name: 'poker-room'`** — sessionStorage 키 이름
- **`storage: createJSONStorage(() => sessionStorage)`** — localStorage 대신 sessionStorage 사용 (탭 종료 시 자동 삭제)
- **`partialize`** — 저장할 상태만 선별

### 3.2 `partialize`로 액션/파생 함수 제외하는 이유

스토어에는 `createRoom`, `selectCard`, `isHost`, `mode` 등의 **함수**도 포함되어 있다. 함수는 JSON으로 직렬화할 수 없으므로 `partialize`로 데이터 필드만 선별한다. 이를 생략하면 Zustand가 전체 상태를 직렬화하려다 함수가 `null`로 변환되어 복원 시 오류가 발생한다.

### 3.3 `leaveRoom()`에서 수동 삭제

```ts
// store/usePokerStore.ts:129-132
leaveRoom: () => {
  set(initialState)
  sessionStorage.removeItem('poker-room')
},
```

`persist` middleware는 `set()` 호출 시 자동으로 저장한다. 하지만 `set(initialState)`는 초기값을 **저장**하는 것이지 키를 **삭제**하는 게 아니다. `sessionStorage.removeItem()`을 명시적으로 호출하여 저장된 상태를 완전히 제거한다. 이렇게 해야 방을 나간 후 새로고침 시 이전 방 상태가 복원되지 않는다.

---

## 4. SSR Hydration 문제와 `useHydration()` 해결

### 4.1 문제

Next.js App Router에서 클라이언트 컴포넌트는 **서버에서 먼저 렌더링**(SSR)된 후 브라우저에서 **hydration**(이벤트 핸들러 부착)된다.

- **서버:** `sessionStorage` 없음 → Zustand의 persist는 초기값 사용
- **브라우저:** `sessionStorage`에서 이전 상태 복원 → 서버와 다른 값

이 불일치가 React hydration mismatch 경고와 깜빡임(FOUC)을 유발한다.

### 4.2 해결: `useHydration.ts`

```ts
// store/useHydration.ts (전체)
import { useEffect, useState } from 'react'
import { usePokerStore } from './usePokerStore'

export function useHydration() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const unsub = usePokerStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    // Already hydrated (e.g. no storage or sync hydration)
    if (usePokerStore.persist.hasHydrated()) {
      setHydrated(true)
    }

    return unsub
  }, [])

  return hydrated
}
```

**동작 원리:**
1. 초기 `hydrated = false` → 서버와 클라이언트 모두 로딩 UI 렌더링 (일치)
2. 브라우저에서 `useEffect` 실행 → `onFinishHydration` 콜백 등록
3. persist middleware가 sessionStorage에서 복원 완료 → `hydrated = true`
4. 이제 Zustand 상태를 신뢰할 수 있으므로 실제 UI 렌더링

**이중 체크 (`hasHydrated()`):** 동기적 hydration이 `useEffect` 전에 완료될 수 있으므로, `hasHydrated()`로 이미 완료된 경우도 처리한다.

### 4.3 사용

```ts
// app/room/[roomId]/page.tsx:20, 231-237
const hydrated = useHydration()

// ...

if (!hydrated) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="animate-pulse text-gray-400">Loading...</div>
    </div>
  )
}
```

`hydrated`가 `false`인 동안은 로딩 UI만 표시한다. `true`가 되면 sessionStorage에서 복원된 상태(`myName`, `roomId` 등)가 정확하므로 조건부 렌더링을 안전하게 수행할 수 있다.

---

## 5. Selector 패턴과 렌더링 최적화

```ts
// app/room/[roomId]/page.tsx:22-41
const myName = usePokerStore((s) => s.myName)
const myId = usePokerStore((s) => s.myId)
const myVote = usePokerStore((s) => s.myVote)
const storeRoomId = usePokerStore((s) => s.roomId)
const revealVotes = usePokerStore((s) => s.revealVotes)
const selectCard = usePokerStore((s) => s.selectCard)
const resetRound = usePokerStore((s) => s.resetRound)
const nextTicket = usePokerStore((s) => s.nextTicket)
const participants = usePokerStore((s) => s.participants)
const phase = usePokerStore((s) => s.phase)
const currentTicket = usePokerStore((s) => s.currentTicket)
const currentTicketIndex = usePokerStore((s) => s.currentTicketIndex)
const tickets = usePokerStore((s) => s.tickets)
const addParticipant = usePokerStore((s) => s.addParticipant)
const removeParticipant = usePokerStore((s) => s.removeParticipant)
const setParticipantVoted = usePokerStore((s) => s.setParticipantVoted)
const setParticipantVote = usePokerStore((s) => s.setParticipantVote)
const applySyncState = usePokerStore((s) => s.applySyncState)
const isHost = usePokerStore((s) => s.isHost)
const leaveRoom = usePokerStore((s) => s.leaveRoom)
```

**왜 개별 selector를 사용하는가?**

Zustand는 selector의 반환값이 변경될 때만 컴포넌트를 리렌더링한다. `usePokerStore()`처럼 전체 상태를 구독하면 **어떤 필드든** 변경될 때마다 리렌더링된다. 개별 selector로 필요한 값만 구독하면 해당 값이 변경될 때만 리렌더링되어 성능이 최적화된다.

```ts
// 비효율적 — 모든 상태 변경에 리렌더링
const state = usePokerStore()

// 효율적 — myVote 변경 시에만 리렌더링
const myVote = usePokerStore((s) => s.myVote)
```

> **참고:** 액션 함수(`selectCard`, `resetRound` 등)는 참조가 변하지 않으므로 selector로 구독해도 불필요한 리렌더링이 발생하지 않는다.

---

## 6. `applySyncState` — P2P 상태 병합

신규 피어가 방에 참여하면 `sync_response`로 기존 게임 상태를 전달받는다. 이때 단순 덮어쓰기가 아닌 **병합** 로직이 필요하다:

```ts
// store/usePokerStore.ts:215-235
applySyncState: (syncState) =>
  set((state) => {
    // 자신의 투표 상태는 유지하면서 나머지 상태를 동기화
    const myId = state.myId
    const myParticipant = state.participants.find((p) => p.id === myId)
    const mergedParticipants = syncState.participants.map((p) =>
      p.id === myId && myParticipant ? myParticipant : p,
    )
    // 자신이 목록에 없으면 추가
    if (myParticipant && !mergedParticipants.some((p) => p.id === myId)) {
      mergedParticipants.push(myParticipant)
    }
    return {
      participants: mergedParticipants,
      tickets: syncState.tickets,
      currentTicketIndex: syncState.currentTicketIndex,
      phase: syncState.phase,
      completedTickets: syncState.completedTickets,
      hostId: syncState.hostId,
    }
  }),
```

**병합 전략:**
1. 원격 참가자 목록에서 **자신의 엔트리만 로컬 버전으로 유지** — 아직 sync되지 않은 자신의 투표 상태를 보존
2. 자신이 원격 목록에 없으면 **추가** — 신규 참가자는 아직 기존 피어의 목록에 반영되지 않았을 수 있음
3. 나머지(`tickets`, `phase`, `hostId` 등)는 **원격 값으로 덮어쓰기** — 호스트의 상태가 기준

---

## Key Takeaways

- **`create<T>()()`** 더블 괄호는 TypeScript 제네릭 + middleware 체이닝을 위한 curried 패턴
- **`set()` 콜백 vs `get()`:** 단순 변환은 `set((state) => ...)`, 복잡한 로직은 `get()` + `set()`
- **`partialize`는 필수** — 함수를 포함한 스토어에서 직렬화 가능한 필드만 선별해야 한다
- **Hydration guard** — `useHydration()` 훅으로 SSR/클라이언트 불일치를 방지하고, 상태 복원 후에만 UI를 렌더링
- **개별 selector 패턴** — 불필요한 리렌더링을 방지하는 Zustand의 핵심 최적화 기법
