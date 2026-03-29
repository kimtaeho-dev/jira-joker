# 포커 게임 (poker-game) 도메인
> 최종 갱신: 2026-03-28

## 개요
Planning Poker 세션의 핵심 게임 흐름을 담당하는 도메인이다. 방 생성/참가, 카드 투표, 결과 공개, 티켓 진행, 세션 완료까지 전체 라이프사이클을 관리하며, WebRTC P2P(또는 서버 릴레이 폴백)를 통해 실시간으로 참가자 간 상태를 동기화한다.

## 앱 구성
- **poker**: 단일 Next.js 앱 — 홈(방 생성 진입), 방 페이지(/room/[roomId]), 방 유효성 확인 API(/api/room/[roomId]), 게임 상태 스토어(usePokerStore), WebRTC 연결 훅(useWebRTC), 포커 테이블·카드덱·티켓 패널·세션 요약 등 모든 게임 UI 컴포넌트를 포함한다.

## 핵심 엔티티
- Participant: 세션 참가자 (id, name, hasVoted, vote)
- JiraTicket: 추정 대상 티켓 (key, summary, storyPoints 등)
- JiraConfig: Jira 연결 설정 (domain, token, email)
- CompletedTicket: 투표 완료된 티켓과 결과 (ticket, votes, result)
- SyncState: P2P 동기화 페이로드 (participants, tickets, phase, completedTickets, hostId)
- DataMessage: WebRTC DataChannel 메시지 유니온 타입

## 외부 도메인 연관
- → 영향을 주는 도메인: signaling (WebRTC 시그널링 서버, SSE 방 상태 공유)
- ← 영향을 받는 도메인: jira-integration (CreateRoomWizard를 통해 JiraConfig·JiraTicket[] 주입 및 createRoom() 호출)
