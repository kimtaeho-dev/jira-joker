# 방 관리 (room) 도메인

> 최종 갱신: 2026-03-25

## 개요

방(Room) 도메인은 Planning Poker 세션의 생명주기를 담당한다. 방 유효성 검사, 참가자 입장/이탈, 호스트 이탈 보호, 추방(kick), 탭 닫기 즉시 이탈 알림 등 방 참가자 간의 연결 상태를 관리한다.

## 앱 구성

- **room page** (`app/room/[roomId]/page.tsx`): 방 진입부터 세션 종료까지 전체 UI 흐름을 조율하는 클라이언트 페이지. 방 유효성 확인, 대기 화면, 이탈/추방 오버레이, 호스트 재접속 대기 화면을 조건부 렌더링한다.
- **room API** (`app/api/room/[roomId]/route.ts`): 방 존재 여부를 서버 측 signalingStore에서 조회하여 `{ exists: boolean }` 응답을 반환하는 단순 엔드포인트.
- **JoinRoomForm** (`components/poker/JoinRoomForm.tsx`): 링크 참가자 닉네임 입력 폼.

## 핵심 엔티티

- **Participant** — 참가자 정보 (id, name, hasVoted, vote). 상세는 ENTITIES.md 참조.
- **RoomEntry** (서버 내부) — signalingStore의 roomId → peerId → PeerEntry 구조. 상세는 ENTITIES.md 참조.
- **PokerState** (room 관련 필드) — roomId, myId, myName, hostId, participants, phase. 상세는 ENTITIES.md 참조.

## 외부 도메인 연관

- → 영향을 주는 도메인:
  - **realtime** — 방 유효성 검사 시 `lib/signalingStore.roomExists()` 직접 호출. 이탈 시 `/api/signaling/[roomId]`에 sendBeacon POST. useWebRTC의 onPeerConnected/onPeerDisconnected 콜백 사용.
  - **poker** — 방 입장/이탈/추방/동기화 등 모든 상태 변경을 `usePokerStore` 액션(joinRoom, leaveRoom, removeParticipant, migrateHost)으로 위임.
- ← 영향을 받는 도메인:
  - **realtime** — onPeerConnected/onPeerDisconnected 콜백으로 참가자 목록 갱신 및 호스트 대기 오버레이 전환. DataChannel 메시지(room_closed, kick, host_migrated, leaving) 수신으로 이탈/추방 처리 트리거.
  - **poker** — 투표 상태(phase, participants)에 따라 대기 화면 vs 포커 테이블 렌더링 결정. 세션 완료 시 방 나가기 트리거.
