# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Jira Joker** is a real-time Planning Poker service that uses WebRTC P2P communication to estimate Jira ticket story points collaboratively. It minimizes server involvement by exchanging data directly between participants via WebRTC DataChannels, with Jira API integration for writing back results.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Real-time:** WebRTC (DataChannel for P2P mesh sync)
- **Jira Integration:** Jira REST API via API Token
- **Styling:** Tailwind CSS + custom design system (Modern Minimal)
- **Fonts:** Geist (body) + Plus Jakarta Sans (display/headings)
- **State Management:** Zustand (client-side only)

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### API Proxy Layer

- **`/api/jira`** — Jira API Token을 서버 측에서 안전하게 처리
  - `GET /api/jira` — 프로젝트의 이슈 목록 조회 (Cloud: `/search/jql`, Server/DC: `/search` 자동 분기)
  - `PUT /api/jira` — Jira 이슈의 Story Points 필드 업데이트
- **`/api/room/[roomId]`** — Room 존재 여부 확인
  - `GET` → `{ exists: boolean }` (signalingStore의 rooms Map 기반)
- **`/api/signaling/[roomId]`** — WebRTC 시그널링 (SSE + POST relay)

### WebRTC Layer

- Room creation generates a UUID used as the invitation link identifier
- Participants form a **mesh network** (each peer connects to all others)
- Signaling is required to exchange SDP offers/answers before P2P is established
- STUN 서버 다중화 (`stun.l.google.com`, `stun1`, `stun2`) — 방화벽 환경 fallback
- ICE candidate 배치 전송 (100ms 윈도우) — 시그널링 왕복 횟수 절감
- ICE candidate 버퍼링: `setRemoteDescription` 완료 전 수신된 candidates를 큐에 보관, 완료 후 일괄 적용 (race condition 방지)
- `iceConnectionState` 감시로 피어 이탈 빠른 감지; SSE heartbeat 15초 주기
- During voting: only **vote completion status** is broadcast (actual card value stays local)
- After all participants vote: 2-second countdown, then actual values sync over DataChannels
- **DataMessage types:** `voted`, `reveal`, `reset`, `next`, `sync_request`, `sync_response`, `room_closed`, `kick`, `host_migrated`, `leaving`

### Server Relay Fallback

- WebRTC P2P 연결 실패 시 (Zscaler, Symmetric NAT 등 기업 보안 환경) 자동으로 **서버 릴레이 모드**로 전환
- 8초 타임아웃: 첫 피어 발견 후 8초 내 DataChannel이 열리지 않으면 릴레이 모드 활성화
- 릴레이 전송: `POST /api/signaling/[roomId]` (type: `relay`) → SSE `relay` 이벤트로 브로드캐스트
- 기존 시그널링 인프라 재사용 — 추가 서버 불필요
- `broadcast`/`sendToPeer` API 동일 — 호출측 코드 변경 없이 투명하게 동작
- `transportMode` 상태 (`connecting` | `p2p` | `relay`) 노출 → PokerTable에 "서버 중계 모드" 배지 표시
- Planning Poker는 초경량 텍스트 교환이므로 릴레이 성능 저하 무시 가능

### Room Management

- **Room 유효성 검사:** 새 참가자가 `/room/[roomId]`에 접근 시 `GET /api/room/[roomId]`로 방 존재 여부 확인 → 미존재 시 not-found UI 표시
- **호스트 능동 이탈:** 호스트가 "방 종료" 클릭 시 `window.confirm()` 확인 → `room_closed` broadcast → 참가자에게 "방이 종료되었습니다" 오버레이 표시 (store 유지, 오버레이에서 홈 이동 시 정리). 호스트 버튼은 빨간 배경("방 종료"), 참가자는 기존 스타일("나가기")
- **참가자 능동 이탈:** 참가자 "나가기" 클릭 시 `leaving` DataChannel broadcast → 즉시 반영. `beforeunload` 시 `sendBeacon`으로 서버에 `leave` POST + DataChannel `leaving` broadcast (탭 닫기에도 ~100ms 내 반영)
- **호스트 이탈 보호:** 호스트 SSE 끊김(비자발적) 시 즉시 종료하지 않고 "호스트 재접속 대기 중" 오버레이 표시. 호스트가 같은 이름으로 재접속하면 `host_migrated` broadcast로 hostId 자동 복원. beforeunload로 실수 탭 닫기 방지. 참가자 0명일 때만 방 종료
- **대기 화면 분리:** 2인 미만 대기 시 호스트는 초대 링크 공유 UI, 참가자는 "호스트와 연결 중..." 간소화 UI 표시
- **호스트 Kick:** 호스트가 `kick` 메시지 broadcast → 대상에게 추방 overlay, 나머지 참가자 목록에서 제거
- **핵심 제약:** 서버(signalingStore)는 room→peers SSE 스트림만 관리하며 hostId 개념 없음. host 판별은 전적으로 클라이언트(Zustand) 기반
- **signalingStore 싱글톤:** `globalThis` 패턴으로 rooms Map 보존 (HMR/모듈 재평가 시 상태 유실 방지)

### State Management (Zustand)

- All voting state lives client-side
- Tracks: current ticket, participant list, vote status per peer, revealed values
- Results computed from synced values: Mode (most common) and Average

### Design System

- **Color tokens:** CSS custom properties in `globals.css` → `@theme inline` 등록 → `bg-primary`, `text-text-secondary` 등으로 사용
  - Primary: indigo-600 (`--primary: #4f46e5`), Accent: emerald-500, Danger: red-500
  - Surface: white/slate 계열, Border: slate-200/60 (subtle)
- **Typography:** `--font-display` (Plus Jakarta Sans) for headings/logo, `--font-sans` (Geist) for body
- **Logo:** `components/Logo.tsx` — SVG spade(♠) icon + "J" + "Jira Joker" wordmark. Props: `size` (sm/md/lg), `showText`
- **Card/Box 공통:** `rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm`
- **Button styles:** Primary (`bg-primary shadow-primary/20`), Secondary (`border-slate-200`), Danger (`bg-danger`), Ghost (`text-slate-500 hover:bg-slate-50`). 모두 `rounded-xl`
- **Input styles:** `rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20`
- **Glassmorphism:** Header/Panel/Overlay에 `bg-white/80 backdrop-blur-md` 적용

### UI Layout

- **Poker Table (center):** Participants arranged on an ellipse around an indigo-violet gradient table surface (`from-indigo-600 to-violet-600`). "Me" always at bottom center, others clockwise. Table center shows voting status / countdown / results with host controls. Host marked with ★ badge (amber-400).
- **Ticket Panel (right float):** Fixed right-side panel (w-96) with toggle button. Contains simplified TicketDetail (key + progress + summary + description) and TicketHistory. Slides in/out. 패널 열림/닫힘 시 메인 콘텐츠에 `lg:pr-96` 적용하여 포커 테이블·카드덱 동적 중앙 정렬. Glassmorphism: `bg-white/90 backdrop-blur-md`.
- **Card Deck (sticky bottom):** Fibonacci cards fixed at bottom of viewport. Only shown when a ticket is active.
- **Header:** `bg-white/80 backdrop-blur-md border-slate-200/60` with Logo component.

### Card Deck

Fibonacci sequence: `1, 2, 3, 5, 8, 13, 21` plus `?` (unknown) and `☕` (coffee break)

## Implementation Status

All core steps are complete:

1. `/api/jira` proxy endpoint (issue fetch + story points PUT)
2. WebRTC signaling layer (UUID routing, SDP exchange)
3. Poker UI and Zustand state (card components, vote tracking)
4. Reveal & sync logic (auto-reveal after full vote, results visualization)
5. Room management (validation, host leave closure, kick)
6. Host reconnection protection (beforeunload + indefinite wait + name-matching restore)
7. Poker table layout (circular table with participants around ellipse, blue table surface)
8. Session summary screen (completed tickets table + total SP)
9. Floating ticket panel (right-side slide panel with toggle, TicketDetail + TicketHistory)
10. Sticky bottom card deck
11. Design system overhaul (Modern Minimal: indigo primary, Plus Jakarta Sans, glassmorphism, SVG logo)
