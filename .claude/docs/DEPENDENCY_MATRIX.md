# Dependency Matrix

> 최종 갱신: 2026-03-28
> 행(→) = 영향을 주는 도메인, 열(←) = 영향을 받는 도메인
> ●: 강한 의존 (데이터/로직 직접 참조)
> ○: 약한 의존 (이벤트/알림 수준)
> -: 의존 없음

|  | Jira 연동 | 실시간 통신 | 포커 게임 |
|---|---|---|---|
| **Jira 연동** | - | - | ● |
| **실시간 통신** | - | - | ○ |
| **포커 게임** | ● | ● | - |

## 의존 상세

### Jira 연동 → 포커 게임 (●)
- CreateRoomWizard가 `JiraConfig`, `JiraTicket` 타입을 `store/usePokerStore.ts`에서 직접 import
- CreateRoomWizard가 `createRoom(name, jiraConfig, tickets)` 액션을 호출하여 포커 게임 상태를 초기화
- 공유 엔티티: JiraConfig, JiraTicket
- 의존 방향 근거: `import { usePokerStore } from '@/store/usePokerStore'` (`components/poker/CreateRoomWizard.tsx`)

### 실시간 통신 → 포커 게임 (○)
- `useWebRTC.ts`가 `SyncState` 타입을 `store/usePokerStore.ts`에서 import (타입 전용, 런타임 의존 없음)
- 공유 엔티티: SyncState
- 의존 방향 근거: `import type { SyncState } from '@/store/usePokerStore'` (`hooks/useWebRTC.ts`)

### 포커 게임 → Jira 연동 (●)
- `app/page.tsx`가 `CreateRoomWizard` 컴포넌트를 렌더링 (방 생성 진입점)
- JiraConfig/JiraTicket 데이터가 createRoom()을 통해 포커 게임 상태에 주입됨
- 공유 엔티티: JiraConfig, JiraTicket
- 의존 방향 근거: `import { CreateRoomWizard } from '@/components/poker/CreateRoomWizard'` (`app/page.tsx`)

### 포커 게임 → 실시간 통신 (●)
- `app/room/[roomId]/page.tsx`가 `useWebRTC` 훅을 import하여 P2P 통신 전체를 위임 (broadcast/sendToPeer)
- `app/api/room/[roomId]/route.ts`가 `signalingStore.roomExists()`를 직접 import하여 방 존재 여부 확인
- 공유 엔티티: DataMessage, TransportMode
- 의존 방향 근거: `import { useWebRTC } from '@/hooks/useWebRTC'`, `import { roomExists } from '@/lib/signalingStore'`
