# Chapter 01: Next.js App Router 기반 프로젝트 구조

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app/page.tsx` | 홈 페이지 (방 생성 위자드) |
| `app/room/[roomId]/page.tsx` | 동적 라우트 — 게임 룸 페이지 |
| `app/api/signaling/[roomId]/route.ts` | API Route — WebRTC 시그널링 (SSE + POST) |
| `app/api/room/[roomId]/route.ts` | API Route — 방 존재 여부 확인 |
| `app/api/jira/route.ts` | API Route — Jira REST API 프록시 |

---

## 1. App Router 디렉토리 구조와 파일 기반 라우팅

Next.js App Router는 `app/` 디렉토리의 파일 시스템 구조가 곧 URL 라우트가 되는 패턴을 사용한다. 이 프로젝트의 라우트 트리는 다음과 같다:

```
app/
├── page.tsx                          → /
├── room/
│   └── [roomId]/
│       └── page.tsx                  → /room/:roomId
├── api/
│   ├── jira/
│   │   └── route.ts                  → /api/jira
│   ├── room/
│   │   └── [roomId]/
│   │       └── route.ts              → /api/room/:roomId
│   └── signaling/
│       └── [roomId]/
│           └── route.ts              → /api/signaling/:roomId
└── layout.tsx                        → 전역 레이아웃
```

핵심 규칙:
- **`page.tsx`** — 해당 경로에 렌더링될 페이지 컴포넌트
- **`route.ts`** — 해당 경로의 API 엔드포인트 (같은 경로에 page.tsx와 공존 불가)
- **`[param]`** — 동적 세그먼트, URL 파라미터를 캡처
- **`layout.tsx`** — 하위 라우트에 공유되는 레이아웃 셸

이 구조만으로 별도 라우팅 설정 없이 5개의 라우트가 자동 생성된다.

---

## 2. React 19 `use()` 훅으로 동적 라우트 params 처리

Next.js App Router에서 동적 세그먼트 `[roomId]`의 파라미터는 **Promise**로 전달된다. React 19의 `use()` 훅으로 이를 unwrap한다:

```tsx
// app/room/[roomId]/page.tsx:17-18
export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
```

**왜 Promise인가?**

Next.js 15+에서 `params`는 비동기로 전환되었다. 이전에는 동기적으로 `{ params: { roomId: string } }`를 받았지만, 이제는 `Promise`로 감싸서 전달한다. 서버 컴포넌트에서는 `await`를, 클라이언트 컴포넌트에서는 `use()`를 사용한다.

> **참고:** API Route에서는 일반적인 `async` 함수이므로 `await params`를 사용한다:
> ```ts
> // app/api/signaling/[roomId]/route.ts:18
> const { roomId } = await params
> ```

---

## 3. `'use client'` 지시어 규칙

Next.js App Router에서 모든 컴포넌트는 기본적으로 **Server Component**다. 클라이언트에서만 동작하는 기능이 필요할 때 파일 최상단에 `'use client'`를 선언한다.

### 이 프로젝트에서의 판단 기준

| 파일 | 지시어 | 이유 |
|------|--------|------|
| `app/page.tsx` | `'use client'` | 하위에 `CreateRoomWizard` (useState, 이벤트 핸들러) 렌더링 |
| `app/room/[roomId]/page.tsx` | `'use client'` | `useState`, `useEffect`, `useCallback`, `use()`, Zustand store |
| `hooks/useWebRTC.ts` | `'use client'` | `useRef`, `useEffect`, `EventSource` (브라우저 API) |
| `store/usePokerStore.ts` | **없음** | Zustand `create()`는 순수 JS — 서버/클라이언트 양쪽에서 import 가능 |
| `lib/signalingStore.ts` | **없음** | 서버 전용 모듈 — 브라우저 API 미사용, API Route에서만 import |
| `app/api/*/route.ts` | **없음** | API Route는 항상 서버에서 실행 |

**판단 흐름:**
1. `useState`, `useEffect`, `useRef` 등 React 훅 사용? → `'use client'`
2. `EventSource`, `RTCPeerConnection`, `navigator` 등 브라우저 API 사용? → `'use client'`
3. 이벤트 핸들러(`onClick` 등) 포함? → `'use client'`
4. 순수 데이터/로직만 export? → 지시어 불필요

---

## 4. API Route Handler 패턴

App Router의 API Route는 `route.ts`에서 HTTP 메서드명을 export하는 방식이다:

```ts
// app/api/room/[roomId]/route.ts (전체)
import { NextResponse } from 'next/server'
import { roomExists } from '@/lib/signalingStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  return NextResponse.json({ exists: roomExists(roomId) })
}
```

### 핵심 요소

**HTTP 메서드 매핑:**
- `export async function GET(...)` → `GET /api/room/:roomId`
- `export async function POST(...)` → `POST /api/room/:roomId`
- 지원 메서드: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

**함수 시그니처:**
```ts
async function METHOD(
  request: NextRequest,                                   // 요청 객체
  { params }: { params: Promise<{ roomId: string }> },    // 동적 파라미터
): Promise<Response>
```

**런타임 설정 export:**
```ts
export const runtime = 'nodejs'       // Node.js 런타임 사용 (Edge 대신)
export const dynamic = 'force-dynamic' // 항상 동적 응답 (SSE에 필수)
```

- `runtime = 'nodejs'`: SSE의 `ReadableStream`, 모듈 레벨 `Map` 등 Node.js 전용 기능 사용 시 필요
- `dynamic = 'force-dynamic'`: 빌드 시 정적 생성을 비활성화 — 실시간 데이터를 반환하는 엔드포인트에 필수

**응답 생성:**
- `NextResponse.json({ ... })` — JSON 응답 (자동 Content-Type 설정)
- `new Response(stream, { headers })` — 스트리밍 응답 (SSE 등)
- `new Response(null, { status: 204 })` — 본문 없는 응답

---

## 5. SSE 스트리밍 응답 구현

시그널링 서버는 Server-Sent Events(SSE)를 사용하여 실시간으로 클라이언트에 이벤트를 push한다. `ReadableStream`을 직접 생성하여 구현한다:

```ts
// app/api/signaling/[roomId]/route.ts:29-72
const stream = new ReadableStream<Uint8Array>({
  start(controller) {
    // 1) 피어를 방에 등록
    addPeer(roomId, peerId, name, controller, encoder)

    // 2) 신규 피어에게 기존 피어 목록 전달
    const existingPeers = getExistingPeers(roomId).filter((p) => p.id !== peerId)
    const roomStateChunk = encoder.encode(
      `event: room_state\ndata: ${JSON.stringify({ peers: existingPeers })}\n\n`,
    )
    controller.enqueue(roomStateChunk)

    // 3) 기존 피어들에게 신규 피어 알림
    broadcast(roomId, peerId, 'peer_joined', { peerId, name })

    // 4) 30초 heartbeat — 연결 유지
    const heartbeatInterval = setInterval(() => {
      try {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      } catch {
        clearInterval(heartbeatInterval)
      }
    }, 30_000)

    // 5) 연결 종료 감지 — cleanup
    request.signal.addEventListener('abort', () => {
      clearInterval(heartbeatInterval)
      removePeer(roomId, peerId)
      broadcast(roomId, peerId, 'peer_left', { peerId })
      try {
        controller.close()
      } catch {
        // already closed
      }
    })
  },
})

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  },
})
```

### SSE 프로토콜 형식

```
event: <이벤트명>\ndata: <JSON 데이터>\n\n
```

이중 줄바꿈(`\n\n`)이 하나의 이벤트 경계를 나타낸다.

### 구현 패턴 분석

| 단계 | 코드 | 역할 |
|------|------|------|
| 등록 | `addPeer(roomId, peerId, name, controller, encoder)` | 서버 메모리에 SSE controller 저장 → 나중에 이벤트 push 가능 |
| 초기 상태 | `room_state` 이벤트 전송 | 이미 방에 있는 피어 목록을 신규 피어에게 알림 |
| 알림 | `broadcast(roomId, peerId, 'peer_joined', ...)` | 기존 피어들에게 신규 피어 진입 통보 |
| Heartbeat | `setInterval` 30초 | SSE 연결이 프록시/로드밸런서에 의해 끊기지 않도록 유지 |
| Cleanup | `request.signal` abort | 클라이언트 연결 종료 시 피어 제거 + `peer_left` broadcast |

**`request.signal`의 역할:**

`NextRequest`는 `AbortSignal`을 포함한다. 클라이언트가 `EventSource`를 닫거나 탭을 종료하면 `abort` 이벤트가 발생한다. 이를 통해 서버가 연결 종료를 감지하고 cleanup을 수행한다. 이 패턴이 없으면 disconnected 피어가 메모리에 계속 남아 있게 된다.

---

## Key Takeaways

- **파일 기반 라우팅:** `app/` 디렉토리 구조가 곧 URL — 라우팅 설정 파일이 필요 없다
- **`page.tsx` vs `route.ts`:** 페이지 컴포넌트와 API 핸들러를 같은 규칙으로 배치하되, 같은 경로에 공존할 수 없다
- **`'use client'` 최소화:** 서버 전용 모듈(`signalingStore`)과 순수 로직(`usePokerStore`)은 지시어 없이 양쪽에서 사용 가능
- **SSE 구현:** `ReadableStream` + `controller.enqueue()` + `request.signal` abort 감지가 핵심 3요소
- **`dynamic = 'force-dynamic'`:** 실시간 응답을 반환하는 API Route에는 반드시 설정해야 한다 (그렇지 않으면 빌드 시 정적으로 캐싱될 수 있음)
