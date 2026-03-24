# 포커 게임 (poker) 도메인

> 최종 갱신: 2026-03-25

## 개요

Planning Poker 세션의 게임 로직을 담당하는 도메인. Jira 연동을 통해 Epic 하위 이슈를 불러오고, 참가자들이 Fibonacci 카드를 투표·공개하여 Story Point를 추정하며, 세션 완료 시 결과를 요약한다.

## 앱 구성

- **page (홈)**: `app/page.tsx` — CreateRoomWizard를 렌더링하는 진입점
- **room page**: `app/room/[roomId]/page.tsx` — 투표·공개·재투표·다음 티켓·세션 완료 게임 흐름 처리 (방 관리는 room 도메인, 통신은 realtime 도메인)
- **components**: `components/poker/` — CreateRoomWizard, CardDeck, PokerCard, PokerTable, TicketPanel, TicketDetail, TicketHistory, SessionSummary

## 핵심 엔티티

- `Participant` — 참가자 정보 및 투표 상태 (id, name, hasVoted, vote)
- `JiraTicket` — 투표 대상 Jira 이슈 (key, summary, description, storyPoints 등)
- `JiraConfig` — Jira 인증 정보 (domain, token, email — Cloud/Server 분기)
- `CompletedTicket` — 투표 완료된 티켓 + 전체 투표값 + Mode/Average 결과
- `SyncState` — P2P 신규 피어 합류 시 전달하는 전체 게임 상태 스냅샷
- `PokerState` — Zustand store 루트 (세션 전체 상태 + 파생 계산 + 액션)

상세 정의는 ENTITIES.md 참조.

## 외부 도메인 연관

- → 영향을 주는 도메인:
  - **jira** — Jira API 프록시를 통해 인증 검증, Epic/이슈 조회 요청 (GET /api/jira)
  - **realtime** — useWebRTC 훅으로 broadcast/sendToPeer 호출, SSE 시그널링 구독
  - **room** — createRoom 후 대기 화면 진입, 세션 종료 시 방 나가기 트리거
- ← 영향을 받는 도메인:
  - **realtime** — DataChannel/릴레이를 통해 수신된 게임 메시지(voted/reveal/reset/next/sync)로 Zustand 상태 갱신
  - **room** — 참가자 추방(kick)이나 피어 이탈(leaving) 시 participants 감소로 투표 조건 변동
