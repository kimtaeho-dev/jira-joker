# Code Structure

> 최종 갱신: 2026-03-28

## 프로젝트 루트 구조

```
.
|-- app
|   |-- api
|   |   |-- jira          # Jira REST 프록시
|   |   |-- room           # 방 존재 여부 확인
|   |   `-- signaling      # SSE 시그널링 + WebRTC 릴레이
|   `-- room
|       `-- [roomId]       # 포커 방 페이지
|-- components
|   `-- poker              # 포커 UI 컴포넌트
|-- hooks                  # 커스텀 훅 (useWebRTC)
|-- lib                    # 서버 유틸 (signalingStore)
|-- public                 # 정적 에셋
`-- store                  # Zustand 상태 관리
```

## 디렉토리 ↔ 도메인 매핑

| 디렉토리 경로 | 도메인 | 앱 | 비고 |
|---|---|---|---|
| `app/api/jira/` | Jira 연동 | poker | Jira REST API 프록시 (Cloud/Server 이중 인증) |
| `app/api/signaling/[roomId]/` | 실시간 통신 | poker | SSE 시그널링 스트림 + POST 릴레이 |
| `app/api/room/[roomId]/` | 포커 게임 | poker | 방 존재 여부 확인 엔드포인트 |
| `app/room/[roomId]/` | 포커 게임 | poker | 포커 방 페이지 (게임 루프 오케스트레이션) |
| `app/page.tsx` | 포커 게임 | poker | 홈 → CreateRoomWizard |
| `components/poker/` | 포커 게임 | poker | UI 컴포넌트 (테이블, 카드, 패널 등) |
| `hooks/` | 실시간 통신 | poker | useWebRTC (SSE + RTCPeerConnection 메시) |
| `lib/` | 실시간 통신 | poker | signalingStore (서버 인메모리 방-피어 관리) |
| `store/usePokerStore.ts` | 포커 게임 | poker | Zustand 상태 + 액션 + 파생 getter |

## 공유 모듈

| 모듈 경로 | 설명 | 사용 도메인 |
|---|---|---|
| `store/useHydration.ts` | SSR hydration guard (Zustand persist rehydration 대기) | 포커 게임 |
| `components/Logo.tsx` | SVG 스페이드 로고 + "Jira Joker" 워드마크 | 포커 게임 |
| `app/layout.tsx` | 루트 레이아웃 (Geist/Plus Jakarta Sans 폰트, 메타데이터) | 전체 |
| `app/globals.css` | Tailwind v4 @theme inline + CSS custom properties | 전체 |
