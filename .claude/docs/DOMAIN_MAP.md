# Domain Map

> 최종 갱신: 2026-03-25
> 생성 기준: 코드베이스 자동 분석 + 수동 보정

## 도메인 맵

### Jira 연동 (jira)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| jira.인증_검증 | → jira.에픽_조회, jira.이슈_목록_조회 | (없음) |
| jira.에픽_조회 | → jira.이슈_목록_조회, poker.방_생성_위저드 | ← jira.인증_검증 |
| jira.이슈_목록_조회 | → poker.방_생성_위저드 | ← jira.에픽_조회, jira.인증_검증 |

### 실시간 통신 (realtime)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| realtime.SSE_시그널링_연결 | → realtime.WebRTC_P2P_협상, realtime.서버_릴레이_폴백, realtime.피어_이탈_처리 | (없음) |
| realtime.WebRTC_P2P_협상 | → realtime.DataChannel_메시지_전송, realtime.서버_릴레이_폴백 | ← realtime.SSE_시그널링_연결 |
| realtime.서버_릴레이_폴백 | → realtime.DataChannel_메시지_전송 | ← realtime.SSE_시그널링_연결, realtime.WebRTC_P2P_협상 |
| realtime.피어_이탈_처리 | → room.호스트_재접속_보호, poker.투표 | ← realtime.SSE_시그널링_연결, room.beforeunload_이탈 |
| realtime.DataChannel_메시지_전송 | → poker.투표, poker.상태_동기화, room.이탈_호스트, room.참가자_추방 | ← realtime.WebRTC_P2P_협상, realtime.서버_릴레이_폴백 |

### 포커 게임 (poker)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| poker.방_생성_위저드 | → room.대기_화면, realtime.SSE_시그널링_연결 | ← jira.이슈_목록_조회 |
| poker.투표 | → poker.투표_공개 | ← poker.재투표, poker.다음_티켓, poker.상태_동기화, realtime.DataChannel_메시지_전송 |
| poker.투표_공개 | → poker.재투표, poker.다음_티켓 | ← poker.투표 |
| poker.재투표 | → poker.투표 | ← poker.투표_공개 |
| poker.다음_티켓 | → poker.세션_완료, poker.투표, poker.티켓_패널 | ← poker.투표_공개 |
| poker.티켓_패널 | (없음) | ← poker.다음_티켓, poker.상태_동기화 |
| poker.세션_완료 | → room.이탈_호스트 | ← poker.다음_티켓 |
| poker.상태_동기화 | → poker.투표, poker.티켓_패널 | ← realtime.DataChannel_메시지_전송 |

### 방 관리 (room)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| room.방_유효성_검사 | → room.방_참가 | ← realtime.SSE_시그널링_연결 |
| room.방_참가 | → room.대기_화면, realtime.SSE_시그널링_연결 | ← room.방_유효성_검사 |
| room.대기_화면 | → poker.투표 | ← poker.방_생성_위저드, room.방_참가, realtime.SSE_시그널링_연결 |
| room.이탈_호스트 | → room.방_종료_오버레이 | ← poker.세션_완료 |
| room.이탈_참가자 | → poker.투표 | (없음) |
| room.호스트_재접속_보호 | → room.대기_화면 | ← realtime.피어_이탈_처리 |
| room.참가자_추방 | → poker.투표, room.방_종료_오버레이 | (없음) |
| room.방_종료_오버레이 | (없음) | ← room.이탈_호스트, room.참가자_추방 |
| room.beforeunload_이탈 | → realtime.피어_이탈_처리, poker.투표 | (없음) |
| room.초대_링크_공유 | (없음) | (없음) |

---

## 교차 도메인 영향 관계 (Cross-Domain Impact)

| 출발 | 도착 | 영향 유형 | 설명 |
|---|---|---|---|
| jira.이슈_목록_조회 | poker.방_생성_위저드 | 데이터 의존 | 조회된 JiraTicket 배열이 createRoom의 tickets 인자로 전달 |
| jira.에픽_조회 | poker.방_생성_위저드 | 데이터 의존 | Epic 유효성 검증 후 이슈 조회 흐름 시작 |
| realtime.DataChannel_메시지_전송 | poker.투표 | 이벤트 트리거 | voted/reveal/reset/next DataMessage가 PokerState 업데이트 트리거 |
| realtime.DataChannel_메시지_전송 | poker.상태_동기화 | 상태 전파 | sync_request/sync_response로 전체 게임 상태 전파 |
| realtime.DataChannel_메시지_전송 | room.이탈_호스트 | 이벤트 트리거 | room_closed DataMessage 수신 시 방 종료 오버레이 표시 |
| realtime.DataChannel_메시지_전송 | room.참가자_추방 | 이벤트 트리거 | kick DataMessage 수신 시 대상 추방/목록 갱신 |
| realtime.피어_이탈_처리 | room.호스트_재접속_보호 | 이벤트 트리거 | onPeerDisconnected에서 호스트 이탈 감지 시 대기 오버레이 표시 |
| realtime.SSE_시그널링_연결 | room.방_유효성_검사 | 데이터 의존 | SSE 연결 시 signalingStore rooms Map에 roomId 등록 → roomExists() 결과 결정 |
| realtime.SSE_시그널링_연결 | room.대기_화면 | 상태 전파 | onPeerConnected 콜백으로 participants 증가 → 대기 화면 탈출 |
| poker.방_생성_위저드 | room.대기_화면 | 상태 전파 | createRoom 완료 후 roomId 확정 → 대기 화면 진입 |
| poker.방_생성_위저드 | realtime.SSE_시그널링_연결 | 이벤트 트리거 | roomId+myName 설정 완료 시 useWebRTC enabled=true → SSE 연결 개시 |
| poker.세션_완료 | room.이탈_호스트 | 이벤트 트리거 | SessionSummary "세션 종료" 버튼 → handleLeaveRoom 호출 |
| room.방_참가 | realtime.SSE_시그널링_연결 | 이벤트 트리거 | joinRoom 후 myName 설정 → useWebRTC enabled=true → SSE 연결 개시 |
| room.beforeunload_이탈 | realtime.피어_이탈_처리 | 이벤트 트리거 | sendBeacon POST type=leave → 서버 removePeer + peer_left broadcast |
| room.참가자_추방 | poker.투표 | 상태 전파 | removeParticipant로 participants 감소 → allVoted 조건 재계산 |
| room.이탈_참가자 | poker.투표 | 상태 전파 | leaving DataMessage 수신 시 removeParticipant → participants 감소 |
| room.beforeunload_이탈 | poker.투표 | 상태 전파 | leaving DataChannel 메시지로 removeParticipant → participants 감소 |
| realtime.피어_이탈_처리 | poker.투표 | 상태 전파 | onPeerDisconnected로 removeParticipant → participants 감소, allVoted 재계산 |
