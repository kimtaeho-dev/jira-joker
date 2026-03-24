# 방 관리 도메인 - 기능 목록

> 최종 갱신: 2026-03-25

---

## room.방_유효성_검사

- **설명**: 링크를 통해 방에 접근하는 새 참가자가 해당 roomId가 서버에 실제로 존재하는지 확인한다. 미존재 시 "방을 찾을 수 없습니다" UI를 표시하고 홈으로 이동 버튼을 제공한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (useEffect — fetch /api/room/${roomId})
  - BE: `app/api/room/[roomId]/route.ts` (GET handler → roomExists())
  - API: `GET /api/room/[roomId]`
- **주요 엔티티**: RoomEntry, PokerState
- **영향을 줌 (impacts)**:
  - `room.방_참가` — 방이 존재할 때만 JoinRoomForm을 렌더링
    - 트리거: roomValid === true
    - 영향 범위: JoinRoomForm 렌더링 여부
- **영향을 받음 (affected_by)**:
  - `realtime.SSE_시그널링_연결` — signalingStore의 rooms Map에 roomId가 존재해야 roomExists()가 true를 반환. 방은 호스트의 SSE 연결(addPeer) 시점에 rooms Map에 등록된다
    - 의존 필드: `lib/signalingStore.ts` → rooms Map (addPeer 시 roomId key 생성)

---

## room.방_참가

- **설명**: 링크를 통해 접근한 사용자가 닉네임을 입력하고 joinRoom() 액션을 호출하여 방에 참가한다. localStorage에 이름을 캐싱하여 재방문 시 자동 입력된다.
- **코드 위치**:
  - FE: `components/poker/JoinRoomForm.tsx`, `app/room/[roomId]/page.tsx`
  - API: (내부 store 직접 호출 — joinRoom action)
- **주요 엔티티**: Participant, PokerState
- **영향을 줌 (impacts)**:
  - `room.대기_화면` — joinRoom() 후 myName이 설정되어 대기 화면 조건 분기 진입
    - 트리거: myName 설정 + storeRoomId === roomId
    - 영향 범위: JoinRoomForm 대신 대기 화면 또는 포커 테이블 렌더링
- **영향을 받음 (affected_by)**:
  - `room.방_유효성_검사` — roomValid === true일 때만 JoinRoomForm 표시
    - 의존 필드: roomValid (local state)

---

## room.대기_화면

- **설명**: 참가자 수가 2인 미만인 경우 게임을 시작하지 않고 대기 상태를 표시한다. 호스트는 초대 링크 공유 UI를, 참가자는 "호스트와 연결 중..." 간소화 UI를 표시한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (participants.length < 2 조건 분기)
- **주요 엔티티**: PokerState (participants)
- **영향을 줌 (impacts)**:
  - `poker.투표` — 2명 이상 모이면 자동으로 메인 포커 테이블로 전환되어 투표 가능 상태 진입
    - 트리거: participants.length >= 2가 되는 시점
    - 영향 범위: 대기 화면 → 포커 테이블 레이아웃 렌더링으로 전환
- **영향을 받음 (affected_by)**:
  - `poker.방_생성_위저드` — createRoom 후 첫 진입 시 대기 상태 시작
    - 의존 필드: PokerState.participants (초기 1명)
  - `room.방_참가` — joinRoom 완료 후 진입
    - 의존 필드: PokerState.participants
  - `realtime.SSE_시그널링_연결` — onPeerConnected 콜백으로 참가자가 추가되어 대기 화면 탈출 조건(participants.length >= 2) 충족
    - 의존 필드: participants (PokerState), DataChannel.readyState === 'open'
  - `room.호스트_재접속_보호` — hostWaiting=true이면 대기 화면이 아닌 재접속 오버레이를 우선 렌더링
    - 의존 필드: hostWaiting (local state)

---

## room.이탈_호스트

- **설명**: 호스트가 "방 종료" 버튼 클릭 시 `window.confirm()` 확인 후 `room_closed` DataMessage를 broadcast하고 leaveRoom()으로 상태를 초기화, 홈으로 이동한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleLeaveRoom — isHost() 분기)
  - API: (WebRTC DataChannel broadcast `room_closed`)
- **주요 엔티티**: PokerState
- **영향을 줌 (impacts)**:
  - `room.방_종료_오버레이` — 참가자 측에서 room_closed 메시지 수신 → disconnectReason='host_left'
    - 트리거: broadcast({ type: 'room_closed' })
    - 영향 범위: 모든 참가자에게 "방이 종료되었습니다" 오버레이 표시
- **영향을 받음 (affected_by)**:
  - `poker.세션_완료` — SessionSummary의 "세션 종료" 버튼이 handleLeaveRoom을 호출
    - 의존 필드: onLeave prop (handleLeaveRoom 함수 참조)
  - `realtime.DataChannel_메시지_전송` — room_closed DataMessage의 전송 경로를 제공
    - 의존 필드: broadcast 함수 (useWebRTC 반환값)

---

## room.이탈_참가자

- **설명**: 참가자가 "나가기" 버튼 클릭 시 `leaving` DataMessage를 broadcast하고 leaveRoom()으로 상태를 초기화, 홈으로 이동한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleLeaveRoom — !isHost() 분기)
  - API: (WebRTC DataChannel broadcast `leaving`)
- **주요 엔티티**: PokerState
- **영향을 줌 (impacts)**:
  - `poker.투표` — 나머지 참가자들이 leaving DataMessage 수신 후 removeParticipant 처리하여 participants 감소 → allVoted 조건 재계산
    - 트리거: leaving DataMessage 수신 시 handleDataMessage에서 removeParticipant 호출
    - 영향 범위: participants 배열 축소
- **영향을 받음 (affected_by)**:
  - (없음 — 참가자 능동 이탈은 자발적 행위)
- **변경 시 체크리스트**:
  - [ ] leaving 메시지 수신 측 처리 변경 시 → handleDataMessage의 leaving case에서 호스트 이탈(hostWaiting 전환)과 일반 참가자 이탈(removeParticipant) 분기 확인

---

## room.호스트_재접속_보호

- **설명**: 호스트의 SSE 연결이 비자발적으로 끊어질 때(onPeerDisconnected) 즉시 방을 종료하지 않고 무기한 대기 오버레이를 표시한다. 동일 이름으로 재접속 시 `host_migrated` broadcast로 hostId를 자동 복원한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (hostWaiting state + onPeerConnected 이름 매칭 로직)
- **주요 엔티티**: PokerState (hostId), RoomEntry
- **영향을 줌 (impacts)**:
  - `room.대기_화면` — hostWaiting === true이면 대기 화면이 아닌 재접속 오버레이를 우선 렌더링
    - 트리거: setHostWaiting(true)
    - 영향 범위: hostWaiting 오버레이가 다른 화면을 전부 가림 (z-50)
- **영향을 받음 (affected_by)**:
  - `realtime.피어_이탈_처리` — onPeerDisconnected 콜백에서 peerId === hostId일 때 setHostWaiting(true) 트리거
    - 의존 필드: hostId (PokerState)

---

## room.참가자_추방

- **설명**: 호스트가 PokerTable 내 참가자 UI에서 특정 참가자를 kick할 때 `kick` DataMessage를 broadcast하고 자신의 참가자 목록에서도 즉시 제거한다. 대상은 "추방되었습니다" 오버레이를 표시한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleKick), `components/poker/PokerTable.tsx` (kick 버튼 트리거)
  - API: (WebRTC DataChannel broadcast `kick`)
- **주요 엔티티**: Participant, PokerState
- **영향을 줌 (impacts)**:
  - `room.방_종료_오버레이` — 대상 참가자 측에서 kick 메시지 수신 → disconnectReason='kicked'
    - 트리거: broadcast({ type: 'kick', targetId })
    - 영향 범위: 대상에게 "방에서 추방되었습니다" 오버레이 표시; 나머지 참가자는 removeParticipant 처리
  - `poker.투표` — removeParticipant로 participants 감소 → allVoted 조건 재계산
    - 트리거: kick 후 removeParticipant 호출
    - 영향 범위: participants 배열 축소, 투표 완료 판정 변경 가능
- **영향을 받음 (affected_by)**:
  - `realtime.DataChannel_메시지_전송` — kick DataMessage의 전송 경로를 제공
    - 의존 필드: broadcast 함수 (useWebRTC 반환값)

---

## room.방_종료_오버레이

- **설명**: 호스트 이탈(host_left) 또는 추방(kicked) 이벤트를 수신한 참가자에게 전체 화면 오버레이를 표시한다. 오버레이에서 홈으로 이동 시 leaveRoom()으로 상태를 정리한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (disconnectReason state 조건 분기)
- **주요 엔티티**: PokerState
- **영향을 줌 (impacts)**:
  - (없음 — 오버레이는 최종 화면이며 leaveRoom() 후 홈으로 이동)
- **영향을 받음 (affected_by)**:
  - `room.이탈_호스트` — room_closed DataMessage 수신 → setDisconnectReason('host_left')
    - 의존 필드: disconnectReason (local state)
  - `room.참가자_추방` — kick DataMessage 수신이고 대상이 myId — setDisconnectReason('kicked')
    - 의존 필드: disconnectReason (local state)

---

## room.beforeunload_이탈

- **설명**: 사용자가 탭을 닫거나 새로고침할 때 `beforeunload` 이벤트에서 `sendBeacon`으로 서버에 leave POST를 전송하고 DataChannel로도 `leaving` broadcast를 시도한다. 호스트의 경우 confirm 대화상자를 추가로 표시한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (beforeunload handler — useEffect)
  - API: `POST /api/signaling/[roomId]` (type: leave, sendBeacon)
- **주요 엔티티**: PokerState (myId, roomId)
- **영향을 줌 (impacts)**:
  - `realtime.피어_이탈_처리` — sendBeacon POST type=leave → 서버의 removePeer() 호출로 SSE 스트림에서 피어 제거 + peer_left broadcast
    - 트리거: sendBeacon POST (type: leave)
    - 영향 범위: 다른 참가자 SSE 스트림에 peer_left 이벤트 발행
  - `poker.투표` — leaving DataChannel 메시지 수신 시 removeParticipant 호출로 participants 감소 → allVoted 조건 재계산
    - 트리거: DataChannel leaving 메시지 수신
    - 영향 범위: participants 배열 축소, 투표 완료 판정 변경 가능
- **영향을 받음 (affected_by)**:
  - (없음 — 브라우저 이벤트 기반 최상위 트리거)

---

## room.초대_링크_공유

- **설명**: 호스트가 대기 화면에서 현재 방 URL을 클립보드에 복사할 수 있다. 헤더의 "링크 복사" 버튼도 동일 기능을 제공한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleCopyInvite — navigator.clipboard.writeText)
- **주요 엔티티**: PokerState (roomId)
- **영향을 줌 (impacts)**:
  - (없음 — 클립보드 복사는 부수 효과 없음)
- **영향을 받음 (affected_by)**:
  - (없음 — 최상위 독립 기능)
- **변경 시 체크리스트**:
  - [ ] HTTPS 환경이 아닌 경우 navigator.clipboard.writeText가 차단될 수 있음 → fallback 필요 여부 확인
  - [ ] copied 상태 2초 타임아웃 로직 변경 시 → 대기 화면과 헤더 버튼 양쪽 동작 확인
