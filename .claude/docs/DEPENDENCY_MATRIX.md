# Dependency Matrix

> 최종 갱신: 2026-03-25
> 행(→) = 영향을 주는 도메인, 열(←) = 영향을 받는 도메인
> ●: 강한 의존 (데이터/로직 직접 참조)
> ○: 약한 의존 (이벤트/알림 수준)
> -: 의존 없음

|  | jira | realtime | poker | room |
|---|---|---|---|---|
| **jira** | - | - | - | - |
| **realtime** | - | - | ● | ● |
| **poker** | ● | ● | - | ● |
| **room** | - | ● | ● | - |

## 의존 상세

### realtime → poker (●)

- `hooks/useWebRTC.ts`가 `@/store/usePokerStore`에서 `SyncState` 타입을 직접 import
- `sync_response` DataMessage의 `state` 필드 타입으로 사용 — 게임 상태 동기화 메시지 구조가 poker 도메인의 상태 정의에 강하게 결합
- 공유 엔티티: SyncState
- 의존 방향 근거: `import { SyncState } from '@/store/usePokerStore'` (hooks/useWebRTC.ts)

### poker → jira (●)

- `components/poker/CreateRoomWizard.tsx`가 `GET /api/jira` 엔드포인트를 호출하여 인증 검증, Epic 조회, 이슈 목록 조회를 수행
- 조회된 이슈 목록이 `createRoom(name, jiraConfig, tickets)` 호출의 직접 입력으로 사용
- 공유 엔티티: JiraConfig, JiraTicket
- 의존 방향 근거: `fetch('/api/jira?type=myself')`, `fetch('/api/jira?type=epic')`, `fetch('/api/jira?type=issues')` (CreateRoomWizard.tsx)

### poker → realtime (●)

- `app/room/[roomId]/page.tsx`가 `hooks/useWebRTC.ts`의 `useWebRTC` 훅을 직접 import하여 P2P/릴레이 메시지 전송 (broadcast, sendToPeer) 수행
- 게임 메시지(voted, reveal, reset, next 등)의 전송 경로가 realtime 도메인에 완전히 의존
- 공유 엔티티: DataMessage, TransportMode
- 의존 방향 근거: `import { useWebRTC } from '@/hooks/useWebRTC'` (app/room/[roomId]/page.tsx)

### room → realtime (●)

- `app/api/room/[roomId]/route.ts`가 `lib/signalingStore.ts`의 `roomExists()` 함수를 직접 import하여 방 존재 여부 확인
- `app/room/[roomId]/page.tsx`가 `useWebRTC` 훅의 `onPeerConnected`, `onPeerDisconnected` 콜백을 사용하여 호스트 재접속/이탈 처리
- 공유 엔티티: PeerEntry (rooms Map)
- 의존 방향 근거: `import { roomExists } from '@/lib/signalingStore'` (app/api/room/[roomId]/route.ts), `import { useWebRTC } from '@/hooks/useWebRTC'` (app/room/[roomId]/page.tsx)

### room → poker (●)

- `app/room/[roomId]/page.tsx`가 `store/usePokerStore.ts`의 Zustand 스토어를 직접 import하여 hostId, participants, phase, tickets 등 게임 상태를 참조/변경
- 방 관리 기능(이탈, kick, 호스트 복원)이 poker 도메인의 상태 액션(leaveRoom, removeParticipant, migrateHost)에 의존
- 공유 엔티티: PokerState, Participant
- 의존 방향 근거: `import { usePokerStore } from '@/store/usePokerStore'` (app/room/[roomId]/page.tsx)

### realtime → room (●)

- onPeerConnected/onPeerDisconnected 콜백이 room 도메인의 참가자 목록 갱신, 호스트 재접속 대기 오버레이 전환을 트리거
- SSE 연결 시 signalingStore rooms Map에 roomId 등록 → `roomExists()` 결과에 영향 (방 유효성 검사)
- 공유 엔티티: PeerEntry (rooms Map)
- 의존 방향 근거: useWebRTC의 onPeerConnected/onPeerDisconnected 콜백 → room page의 hostWaiting/participants 상태 변경

### poker → room (●)

- `poker.방_생성_위저드` 완료 후 `room.대기_화면` 진입 트리거 (createRoom → router.push → 대기 화면)
- `poker.세션_완료`에서 "세션 종료" 버튼이 `room.이탈_호스트`(handleLeaveRoom) 호출
- 공유 엔티티: PokerState (roomId, phase)
- 의존 방향 근거: router.push('/room/' + roomId) (CreateRoomWizard.tsx), onLeave prop (SessionSummary.tsx)
