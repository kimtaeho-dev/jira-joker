# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Jira Joker** is a real-time Planning Poker service that uses WebRTC P2P communication to estimate Jira ticket story points collaboratively. It minimizes server involvement by exchanging data directly between participants via WebRTC DataChannels, with Jira API integration for writing back results.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Real-time:** WebRTC (DataChannel for P2P mesh sync)
- **Jira Integration:** Jira REST API via API Token
- **Styling:** Tailwind CSS + shadcn/ui
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
  - `GET /api/jira` — 프로젝트의 이슈 목록 조회
  - `PUT /api/jira` — Jira 이슈의 Story Points 필드 업데이트
- **`/api/room/[roomId]`** — Room 존재 여부 확인
  - `GET` → `{ exists: boolean }` (signalingStore의 rooms Map 기반)
- **`/api/signaling/[roomId]`** — WebRTC 시그널링 (SSE + POST relay)

### WebRTC Layer

- Room creation generates a UUID used as the invitation link identifier
- Participants form a **mesh network** (each peer connects to all others)
- Signaling is required to exchange SDP offers/answers before P2P is established
- During voting: only **vote completion status** is broadcast (actual card value stays local)
- After all participants vote: 2-second countdown, then actual values sync over DataChannels
- **DataMessage types:** `voted`, `reveal`, `reset`, `next`, `sync_request`, `sync_response`, `room_closed`, `kick`

### Room Management

- **Room 유효성 검사:** 새 참가자가 `/room/[roomId]`에 접근 시 `GET /api/room/[roomId]`로 방 존재 여부 확인 → 미존재 시 not-found UI 표시
- **호스트 이탈 시 방 종료:** 호스트 정상 이탈 시 `room_closed` broadcast, 비정상 이탈(탭 종료) 시 `onPeerDisconnected`에서 hostId 비교로 감지 → 참가자에게 종료 overlay
- **호스트 Kick:** 호스트가 `kick` 메시지 broadcast → 대상에게 추방 overlay, 나머지 참가자 목록에서 제거
- **핵심 제약:** 서버(signalingStore)는 room→peers SSE 스트림만 관리하며 hostId 개념 없음. host 판별은 전적으로 클라이언트(Zustand) 기반

### State Management (Zustand)

- All voting state lives client-side
- Tracks: current ticket, participant list, vote status per peer, revealed values
- Results computed from synced values: Mode (most common) and Average

### Card Deck

Fibonacci sequence: `1, 2, 3, 5, 8, 13, 21` plus `?` (unknown) and `☕` (coffee break)

## Implementation Status

All core steps are complete:

1. `/api/jira` proxy endpoint (issue fetch + story points PUT)
2. WebRTC signaling layer (UUID routing, SDP exchange)
3. Poker UI and Zustand state (card components, vote tracking)
4. Reveal & sync logic (auto-reveal after full vote, results visualization)
5. Room management (validation, host leave closure, kick)
