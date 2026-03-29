# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server (Next.js 16, http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config: Next.js vitals + TS + simple-import-sort)
npm run format       # Prettier auto-format
npm run format:check # Prettier check only
```

No test framework is configured.

## Code Style

- No semicolons, single quotes, trailing commas, 100-char line width (Prettier)
- Imports must be sorted by `simple-import-sort` (ESLint error)
- Tailwind classes auto-sorted by `prettier-plugin-tailwindcss`
- `@/*` path alias → project root
- TypeScript strict mode

## Architecture

**Jira Joker** — WebRTC P2P real-time Planning Poker for Jira story point estimation.

### No Database — All State Is In-Memory or Browser-Side

- **Server:** `lib/signalingStore.ts` — module-level `Map<roomId, Map<peerId, PeerEntry>>` singleton holding SSE connections. Rooms exist only while peers are connected.
- **Client:** Zustand store (`store/usePokerStore.ts`) persisted to `sessionStorage` key `poker-room`. Hydration guard via `store/useHydration.ts` prevents SSR mismatch.

### Data Flow

1. **Room creation:** Host fills 3-step wizard (`CreateRoomWizard`) → creds validated via `/api/jira` proxy → `createRoom()` generates roomId, sets hostId = myId
2. **Joining:** Participant opens `/room/[roomId]` → `JoinRoomForm` if no stored name → `joinRoom()` sets myId/myName
3. **Signaling:** `useWebRTC` hook connects SSE at `GET /api/signaling/[roomId]` → gets peer list → creates RTCPeerConnection to each existing peer → Full Mesh topology
4. **Game messages:** All game state (vote, reveal, reset, next, kick, sync) flows through WebRTC DataChannels. Server relay (`POST /api/signaling/[roomId]`) is fallback when P2P fails (8s timeout).
5. **State sync:** New peers send `sync_request` → existing peer replies with `sync_response` containing full game state including `hostId`

### Jira API Proxy (`/api/jira`)

Dual auth — determined by presence of `email` header:
- **Cloud:** `Basic base64(email:token)` → `{domain}/rest/api/3/...`
- **Server/DC:** `Bearer token` → `{domain}/rest/api/2/...`

Credentials passed per-request via `X-Jira-Domain`, `X-Jira-Token`, `X-Jira-Email` headers (never stored server-side). Client caches in `localStorage` key `jira-joker-credentials`.

Story points field: `customfield_10016` (Jira Cloud standard).

### Key Patterns

- All interactive components use `'use client'`; store files have no directive
- Zustand store uses `create<T>()()` double-call with `persist()` middleware
- Next.js 16 dynamic route pages unwrap `params` with React 19 `use(params)` hook
- `useWebRTC` returns `{ broadcast, sendToPeer, transportMode }` — components never touch RTCPeerConnection directly
- Host role is authoritative: only host triggers reveal/reset/next/kick; `isHost()` derived from `myId === hostId`
- Host reconnection: `beforeunload` sends `leaving` via sendBeacon; returning host matched by name → `host_migrated` restores hostId

### Design System

- **Tailwind v4** with `@theme inline` in `globals.css` — no tailwind.config file
- CSS custom properties for colors (indigo primary `--primary: #4f46e5`), surfaces, borders
- Fonts: Geist (`font-sans`), Plus Jakarta Sans (`font-display`), Geist Mono (`font-mono`)
- Glassmorphism: `backdrop-blur` + semi-transparent backgrounds on cards/panels

### Room Page Layout (`app/room/[roomId]/page.tsx`)

- `PokerTable` — center, circular table with elliptical participant seating
- `TicketPanel` — right floating panel (w-96), toggleable, dynamic `lg:pr-96` shifts main content
- `CardDeck` — sticky bottom Fibonacci cards (`CARD_VALUES` exported from `CardDeck.tsx`)
- `SessionSummary` — replaces table when all tickets complete

## Workflow Conventions

- 커밋은 논리적 단위로 분리, `feat/fix/chore/refactor` prefix + 한국어 본문
- 작업 완료 후 commit + push까지 진행
- 제품 변경 시 이 CLAUDE.md도 함께 업데이트 (Architecture, Key Patterns 등 해당 섹션)
