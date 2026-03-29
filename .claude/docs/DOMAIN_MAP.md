# Domain Map

> 최종 갱신: 2026-03-28
> 생성 기준: 코드베이스 자동 분석 + 수동 보정

## 도메인 맵

### Jira 연동 (jira-integration)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| poker.jira_auth_validate | → poker.jira_creds_cache, → poker.epic_search | ← poker.jira_creds_cache |
| poker.jira_creds_cache | → poker.jira_auth_validate | ← poker.jira_auth_validate |
| poker.epic_search | → poker.issues_fetch | ← poker.jira_auth_validate |
| poker.issues_fetch | → poker.카드_선택, → poker.티켓_패널 | ← poker.epic_search |

### 실시간 통신 (realtime-communication)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| poker.sse_connection | → poker.webrtc_negotiation, → poker.방_입장_참가자, → poker.호스트_재접속 | (없음) |
| poker.webrtc_negotiation | → poker.game_message_broadcast, → poker.relay_fallback | ← poker.sse_connection |
| poker.relay_fallback | → poker.game_message_broadcast | ← poker.webrtc_negotiation |
| poker.peer_disconnect | → poker.호스트_재접속, → poker.방_종료_및_이탈 | ← poker.방_종료_및_이탈, ← poker.참가자_추방 |
| poker.room_existence_check | → poker.방_유효성_검사 | ← poker.peer_disconnect |
| poker.game_message_broadcast | → poker.카드_선택, → poker.투표_공개, → poker.재투표, → poker.다음_티켓, → poker.참가자_추방, → poker.방_종료_및_이탈, → poker.호스트_재접속 | ← poker.webrtc_negotiation, ← poker.relay_fallback |

### 포커 게임 (poker-game)

| 기능 ID | 영향을 주는 곳 → | ← 영향을 받는 곳 |
|---|---|---|
| poker.방_유효성_검사 | → poker.방_입장_참가자 | ← poker.room_existence_check |
| poker.방_입장_참가자 | → poker.방_대기_화면 | ← poker.방_유효성_검사 |
| poker.방_대기_화면 | (없음) | ← poker.방_입장_참가자, ← poker.sse_connection |
| poker.카드_선택 | → poker.투표_공개 | ← poker.투표_공개, ← poker.issues_fetch, ← poker.game_message_broadcast |
| poker.투표_공개 | → poker.결과_표시, → poker.카드_선택 | ← poker.카드_선택, ← poker.game_message_broadcast |
| poker.결과_표시 | → poker.재투표, → poker.다음_티켓 | ← poker.투표_공개 |
| poker.재투표 | → poker.카드_선택 | ← poker.결과_표시, ← poker.game_message_broadcast |
| poker.다음_티켓 | → poker.세션_완료, → poker.카드_선택 | ← poker.결과_표시, ← poker.game_message_broadcast |
| poker.세션_완료 | (없음) | ← poker.다음_티켓 |
| poker.티켓_패널 | (없음) | ← poker.issues_fetch, ← poker.다음_티켓 |
| poker.참가자_추방 | → poker.peer_disconnect | (없음) |
| poker.방_종료_및_이탈 | → poker.peer_disconnect | ← poker.game_message_broadcast |
| poker.호스트_재접속 | (없음) | ← poker.peer_disconnect, ← poker.sse_connection, ← poker.game_message_broadcast |
| poker.p2p_연결_및_릴레이 | (없음) | ← poker.sse_connection, ← poker.webrtc_negotiation, ← poker.relay_fallback |

---

## 교차 도메인 영향 관계 (Cross-Domain Impact)

| 출발 | 도착 | 영향 유형 | 설명 |
|---|---|---|---|
| poker.issues_fetch | poker.카드_선택 | 데이터 의존 | JiraTicket[] → createRoom() → 투표 대상 티켓 설정 |
| poker.issues_fetch | poker.티켓_패널 | 데이터 의존 | JiraTicket 상세(description/assignee) → 패널 표시 |
| poker.sse_connection | poker.방_입장_참가자 | 상태 전파 | onPeerConnected 콜백 → addParticipant() 호출 |
| poker.sse_connection | poker.호스트_재접속 | 상태 전파 | 새 피어 연결 시 이름 매칭 → 호스트 복원 트리거 |
| poker.game_message_broadcast | poker.카드_선택 | 이벤트 트리거 | voted 메시지 → setParticipantVoted() |
| poker.game_message_broadcast | poker.투표_공개 | 이벤트 트리거 | reveal 메시지 → setParticipantVote() |
| poker.game_message_broadcast | poker.재투표 | 이벤트 트리거 | reset 메시지 → resetRound() |
| poker.game_message_broadcast | poker.다음_티켓 | 이벤트 트리거 | next 메시지 → nextTicket() |
| poker.game_message_broadcast | poker.참가자_추방 | 이벤트 트리거 | kick 메시지 → 대상 퇴장 처리 |
| poker.game_message_broadcast | poker.방_종료_및_이탈 | 이벤트 트리거 | room_closed/leaving 메시지 → leaveRoom() |
| poker.game_message_broadcast | poker.호스트_재접속 | 이벤트 트리거 | host_migrated 메시지 → migrateHost() |
| poker.room_existence_check | poker.방_유효성_검사 | 데이터 의존 | signalingStore.roomExists() → { exists: boolean } |
| poker.peer_disconnect | poker.호스트_재접속 | 이벤트 트리거 | 호스트 SSE 끊김 감지 → 대기 오버레이 표시 |
| poker.peer_disconnect | poker.방_종료_및_이탈 | 이벤트 트리거 | peer_left → removeParticipant() |
| poker.방_종료_및_이탈 | poker.peer_disconnect | 이벤트 트리거 | sendBeacon POST → peer_left broadcast |
| poker.참가자_추방 | poker.peer_disconnect | 이벤트 트리거 | kick 대상 퇴장 → SSE 정리 |
| poker.방_대기_화면 | poker.issues_fetch | 데이터 의존 | app/page.tsx → CreateRoomWizard 렌더링, createRoom() 통해 JiraTicket[] 주입 |
