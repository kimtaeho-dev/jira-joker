# Code Structure

> 최종 갱신: 2026-03-25

## 프로젝트 루트 구조

```
.
|-- app
|   |-- api
|   |   |-- jira          # Jira REST API 프록시
|   |   |-- room           # 방 존재 여부 확인 API
|   |   `-- signaling      # WebRTC 시그널링 (SSE + POST relay)
|   `-- room
|       `-- [roomId]       # 포커 게임 룸 페이지
|-- components
|   `-- poker              # 포커 게임 UI 컴포넌트
|-- hooks                  # 커스텀 훅 (useWebRTC 등)
|-- lib                    # 유틸리티/싱글톤 (signalingStore 등)
|-- store                  # Zustand 상태 관리
|-- public                 # 정적 에셋
`-- docs                   # 프로젝트 문서
```

## 디렉토리 ↔ 도메인 매핑

| 디렉토리 경로 | 도메인 | 앱 | 비고 |
|---|---|---|---|
| `app/api/jira/` | Jira 연동 | api | Jira REST API 프록시 (이슈 조회, SP 업데이트) |
| `app/api/signaling/` | 실시간 통신 | api | WebRTC 시그널링 SSE + relay POST |
| `app/api/room/` | 방 관리 | api | 방 존재 여부 확인 엔드포인트 |
| `app/room/[roomId]/` | 포커 게임 | page | 게임 룸 페이지 (투표/결과/관리 통합) |
| `app/` (루트) | 포커 게임 | page | 홈 페이지 (CreateRoomWizard) |
| `components/poker/` | 포커 게임 | component | 포커 게임 UI 컴포넌트 전체 |
| `hooks/` | 실시간 통신 | hook | useWebRTC 훅 |
| `lib/` | 실시간 통신 | lib | signalingStore 싱글톤 |
| `store/` | 포커 게임 | store | Zustand 상태 관리 (usePokerStore) |

## 공유 모듈

| 모듈 경로 | 설명 | 사용 도메인 |
|---|---|---|
| `store/usePokerStore.ts` | 전체 게임 상태 관리 (roomId, participants, votes, tickets 등) | 포커 게임, 방 관리, Jira 연동 |
| `store/useHydration.ts` | SSR hydration guard 훅 | 포커 게임 |
| `lib/signalingStore.ts` | SSE 컨트롤러 rooms Map 싱글톤 | 실시간 통신, 방 관리 |
| `components/Logo.tsx` | 공통 로고 컴포넌트 | 전체 |
