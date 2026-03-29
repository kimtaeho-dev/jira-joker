# 분석 대상

> 생성일: 2026-03-29

## 도메인 목록 (3개)

| 도메인 | 영문명 | FEATURES.md | ENTITIES.md | OVERVIEW.md | 분석 대상 |
|---|---|---|---|---|---|
| Jira 연동 | jira-integration | O | O | O | O |
| 실시간 통신 | realtime-communication | O | O | O | O |
| 포커 게임 | poker-game | O | O | O | O |

## 코드 경로 매핑

| 도메인 | 주요 디렉토리 |
|---|---|
| jira-integration | app/api/jira/, components/poker/CreateRoomWizard.tsx |
| realtime-communication | app/api/signaling/[roomId]/, hooks/useWebRTC.ts, lib/signalingStore.ts |
| poker-game | app/room/[roomId]/, components/poker/, store/usePokerStore.ts, app/api/room/[roomId]/ |

## 스택 유형
- A (Next.js App Router + Zustand + WebRTC)
