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

> The project has not been initialized yet. Once `npx create-next-app` or equivalent is run, standard Next.js commands apply:

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint
npm test         # Run tests (if configured)
```

## Architecture

### API Proxy Layer (`/api/jira`)

- Handles Jira API Token securely server-side (never exposed to client)
- `GET /api/jira` — fetches issue list for a given project
- `PUT /api/jira` — updates the `Story Points` field on a Jira issue

### WebRTC Layer

- Room creation generates a UUID used as the invitation link identifier
- Participants form a **mesh network** (each peer connects to all others)
- Signaling is required to exchange SDP offers/answers before P2P is established
- During voting: only **vote completion status** is broadcast (actual card value stays local)
- After all participants vote: 2-second countdown, then actual values sync over DataChannels

### State Management (Zustand)

- All voting state lives client-side
- Tracks: current ticket, participant list, vote status per peer, revealed values
- Results computed from synced values: Mode (most common) and Average

### Card Deck

Fibonacci sequence: `1, 2, 3, 5, 8, 13, 21` plus `?` (unknown) and `☕` (coffee break)

## Implementation Roadmap

1. **Step 1:** `/api/jira` proxy endpoint (issue fetch + story points PUT)
2. **Step 2:** WebRTC signaling layer (UUID routing, SDP exchange)
3. **Step 3:** Poker UI and Zustand state (card components, vote tracking)
4. **Step 4:** Reveal & sync logic (auto-reveal after full vote, results visualization)
