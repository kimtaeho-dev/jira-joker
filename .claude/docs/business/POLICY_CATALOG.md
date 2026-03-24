# Policy Catalog

> 최종 갱신: 2026-03-25
> 생성 기준: 코드베이스 자동 분석 + 수동 보정

## 요약

| 도메인 | 정책 수 | 에러 시나리오 수 | 설정값 수 |
|---|---|---|---|
| Jira 연동 (jira) | 15 | 11 | 1 |
| 실시간 통신 (realtime) | 24 | 7 | 3 |
| 포커 게임 (poker) | 43 | 11 | 6 |
| 방 관리 (room) | 22 | 3 | 3 |
| **합계** | **104** | **32** | **13** |

> 주: poker 도메인은 통합 페이지(`app/room/[roomId]/page.tsx`)를 분석하여 jira/realtime/room 도메인과 일부 정책이 중복됨. 공통 정책 섹션 참조.

## 도메인별 정책 색인

### Jira 연동 (jira)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-001 | Cloud 모드 필수 필드 검증 (domain, email, token) | jira.인증_검증 | validation |
| POL-002 | Server/DC 모드 필수 필드 검증 (domain, token) | jira.인증_검증 | validation |
| POL-003 | 서버 측 인증 헤더 필수 검증 | jira.인증_검증 | validation |
| POL-004 | Cloud/Server 인증 방식 분기 (email 존재 여부) | jira.인증_검증 | 데이터 제약 |
| POL-005 | domain URL 정규화 (https:// 자동 추가, 끝 / 제거) | jira.인증_검증 | 데이터 제약 |
| POL-006 | epicKey 필수 검증 (BE, epic) | jira.에픽_조회 | validation |
| POL-007 | Epic 타입 유효성 검증 (hierarchyLevel=1 or 이름 매칭) | jira.에픽_조회 | validation |
| POL-008 | Epic 검색 입력값 공백 시 요청 차단 (FE) | jira.에픽_조회 | validation |
| POL-009 | Epic 검색 결과 변경 시 이전 결과 초기화 | jira.에픽_조회 | 상태 전이 |
| POL-010 | epicKey 필수 검증 (BE, issues) | jira.이슈_목록_조회 | validation |
| POL-011 | Cloud/Server JQL 분기 | jira.이슈_목록_조회 | 데이터 제약 |
| POL-012 | 이슈 조회 최대 100건 제한 | jira.이슈_목록_조회 | 설정값 |
| POL-013 | description ADF/plain 분기 변환 | jira.이슈_목록_조회 | 데이터 제약 |
| POL-014 | 방 생성 버튼 활성화 조건 (Epic + 이슈 > 0) | jira.이슈_목록_조회 | validation |
| POL-015 | type 파라미터 유효값 제한 (myself, epic, issues) | jira.인증_검증 | validation |

### 실시간 통신 (realtime)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-001 | SSE 연결 시 peerId, name 필수 | realtime.SSE_시그널링_연결 | validation |
| POL-002 | SSE 활성화 조건 (roomId + myName) | realtime.SSE_시그널링_연결 | validation |
| POL-003 | 빈 피어 목록 시 P2P 시도 안 함 | realtime.SSE_시그널링_연결 | validation |
| POL-004 | 중복 peer_joined 이벤트 무시 | realtime.SSE_시그널링_연결 | validation |
| POL-005 | heartbeat 15초 간격 | realtime.SSE_시그널링_연결 | 설정값 |
| POL-006 | 중복 peer_left broadcast 방지 (removePeer 반환값) | realtime.SSE_시그널링_연결 | validation |
| POL-007 | 릴레이 모드 중 PeerConnection 생성 안 함 | realtime.WebRTC_P2P_협상 | validation |
| POL-008 | ICE candidate 버퍼링 (remoteDescription 전) | realtime.WebRTC_P2P_협상 | 데이터 제약 |
| POL-009 | ICE candidate 100ms 배치 전송 | realtime.WebRTC_P2P_협상 | 설정값 |
| POL-010 | offer 선착 시 방어적 PeerConnection 생성 | realtime.WebRTC_P2P_협상 | validation |
| POL-011 | iceConnectionState failed 즉시 close | realtime.WebRTC_P2P_협상 | 상태 전이 |
| POL-012 | connectionState disconnected/failed/closed 시 이탈 처리 | realtime.WebRTC_P2P_협상 | 상태 전이 |
| POL-013 | 릴레이 폴백 타이머 중복 방지 | realtime.서버_릴레이_폴백 | validation |
| POL-014 | 8초 내 DataChannel 미오픈 시 릴레이 전환 | realtime.서버_릴레이_폴백 | 설정값 |
| POL-015 | 릴레이 모드 단방향 전환 (불가역) | realtime.서버_릴레이_폴백 | 상태 전이 |
| POL-016 | 릴레이 전환 시 기존 PeerConnection 전체 close | realtime.서버_릴레이_폴백 | 상태 전이 |
| POL-017 | 릴레이 모드에서 initiator만 sync_request 전송 | realtime.서버_릴레이_폴백 | 권한 |
| POL-018 | leave POST 중복 peer_left 방지 | realtime.피어_이탈_처리 | validation |
| POL-019 | 마지막 피어 제거 시 방 자동 삭제 | realtime.피어_이탈_처리 | 상태 전이 |
| POL-020 | DataChannel onclose 미처리 (중복 방지) | realtime.피어_이탈_처리 | validation |
| POL-021 | broadcast는 open DataChannel에만 전송 | realtime.DataChannel_메시지_전송 | validation |
| POL-022 | sendToPeer는 open DataChannel에만 전송 | realtime.DataChannel_메시지_전송 | validation |
| POL-023 | JSON 파싱 실패 조용히 무시 | realtime.DataChannel_메시지_전송 | validation |
| POL-024 | broadcast 시 송신자 자신 제외 | realtime.DataChannel_메시지_전송 | 데이터 제약 |

### 포커 게임 (poker)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-013 | 전원 투표 완료(isAllVoted) 조건 | poker.투표 | validation |
| POL-014 | 투표 시 실제 값 미전송 (완료 사실만 broadcast) | poker.투표 | 데이터 제약 |
| POL-015 | 같은 라운드 내 카드 재선택 허용 | poker.투표 | 권한 |
| POL-016 | revealed 단계에서 카드 선택 비활성화 | poker.투표 | 권한 |
| POL-017 | 카드 값 Fibonacci 7종 + 특수 2종 고정 | poker.투표 | 설정값 |
| POL-018 | 전원 투표 후 2초 카운트다운 자동 공개 | poker.투표_공개 | 설정값 |
| POL-019 | 미투표자 reveal 시 '?' 자동 대체 | poker.투표_공개 | 데이터 제약 |
| POL-020 | Mode 계산 시 미투표자 제외 | poker.투표_공개 | 데이터 제약 |
| POL-021 | Average 계산 시 비숫자('?','☕') 제외 | poker.투표_공개 | 데이터 제약 |
| POL-022 | Re-vote/Next 호스트 전용, revealed 상태에서만 | poker.투표_공개 | 권한 |
| POL-023 | 재투표는 호스트만 실행 가능 | poker.재투표 | 권한 |
| POL-024 | 재투표 시 전체 참가자 투표 상태 초기화 | poker.재투표 | 상태 전이 |
| POL-025 | 다음 티켓 진행 시 Mode/Average 결과 기록 | poker.다음_티켓 | 상태 전이 |
| POL-026 | 마지막 티켓 판별 조건 | poker.다음_티켓 | validation |
| POL-027 | 세션 완료 진입 조건 (currentTicket=null + tickets>0) | poker.세션_완료 | validation |
| POL-028 | 총 SP 합산 시 비숫자 mode 0 처리 | poker.세션_완료 | 데이터 제약 |
| POL-029 | sync_request는 신규 피어(initiator)만 전송 | poker.상태_동기화 | 권한 |
| POL-030 | applySyncState 시 자신의 투표 보존 | poker.상태_동기화 | 데이터 제약 |
| POL-031 | 중복 참가자 추가 차단 | poker.상태_동기화 | validation |
| POL-032 | 중복 이탈 이벤트 무시 | poker.상태_동기화 | validation |
| POL-042 | JiraConfig는 SyncState에 미포함 (보안) | poker.상태_동기화 | 데이터 제약 |
| POL-043 | PokerState sessionStorage persist (새로고침 복구) | poker.상태_동기화 | 설정값 |

> 주: poker POL-001~012, POL-033~041은 jira/realtime/room 도메인과 동일 코드에서 추출된 중복 정책. 공통 정책 참조.

### 방 관리 (room)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-001 | 방 존재 여부 사전 검증 (서버 API) | room.방_유효성_검사 | validation |
| POL-002 | 이미 입장한 참가자는 검증 우회 | room.방_유효성_검사 | validation |
| POL-003 | roomExists 판정 기준 (SSE rooms Map) | room.방_유효성_검사 | 데이터 제약 |
| POL-004 | 닉네임 공백 제출 차단 | room.방_참가 | validation |
| POL-005 | 참가자 ID UUID v4 자동 생성 | room.방_참가 | 데이터 제약 |
| POL-006 | 닉네임 localStorage 캐싱 | room.방_참가 | 설정값 |
| POL-007 | 2인 미만 대기 조건 | room.대기_화면 | validation |
| POL-008 | 대기 화면 역할별 분기 (호스트/참가자) | room.대기_화면 | 권한 |
| POL-009 | 복사 피드백 2초 지속 | room.대기_화면 | 설정값 |
| POL-010 | 호스트 방 종료 confirm 필수 | room.이탈_호스트 | validation |
| POL-011 | 호스트 이탈 시 room_closed broadcast | room.이탈_호스트 | 상태 전이 |
| POL-012 | 참가자 이탈 시 leaving broadcast | room.이탈_참가자 | 상태 전이 |
| POL-013 | leaving 중복 처리 방지 | room.이탈_참가자 | validation |
| POL-014 | 호스트 비자발적 이탈 시 무기한 대기 | room.호스트_재접속_보호 | 상태 전이 |
| POL-015 | 호스트 재접속 이름 매칭 판별 | room.호스트_재접속_보호 | validation |
| POL-016 | host_migrated 500ms 지연 발송 | room.호스트_재접속_보호 | 설정값 |
| POL-017 | 피어 이탈 중복 처리 방지 | room.호스트_재접속_보호 | validation |
| POL-018 | kick 대상 자신/타인 분기 처리 | room.참가자_추방 | 권한 |
| POL-019 | 호스트만 beforeunload confirm 표시 | room.beforeunload_이탈 | 권한 |
| POL-020 | sendBeacon + DataChannel 이중 이탈 알림 | room.beforeunload_이탈 | 데이터 제약 |
| POL-021 | 마지막 피어 제거 시 방 자동 삭제 | room.beforeunload_이탈 | 상태 전이 |
| POL-022 | disconnectReason별 오버레이 메시지 분기 | room.방_종료_오버레이 | 데이터 제약 |

## 공통 정책 (Cross-Domain)

| 정책 ID | 규칙 요약 | 적용 도메인 | 비고 |
|---|---|---|---|
| COMMON-001 | 2인 미만 시 게임 진행 차단 (대기 화면) | poker, room | room POL-007 / poker POL-038: 동일 조건(participants.length < 2), 동일 코드 |
| COMMON-002 | 릴레이 폴백 타임아웃 8초 | realtime, poker | realtime POL-014 / poker POL-033: 동일 상수(RELAY_FALLBACK_TIMEOUT) |
| COMMON-003 | 호스트 방 종료 시 confirm 필수 | room, poker | room POL-010 / poker POL-040: 동일 window.confirm 호출 |
| COMMON-004 | 이슈 조회 최대 100건 | jira, poker | jira POL-012 / poker POL-011: 동일 maxResults 제한 |
| COMMON-005 | 중복 피어 이탈 처리 방지 | realtime, room, poker | 다중 경로(SSE+ICE+DataChannel)에서 동일 피어의 이탈을 중복 처리하지 않도록 가드 |
| COMMON-006 | JiraConfig P2P 전송 제외 (보안) | poker | poker POL-042: SyncState에서 jiraConfig 제외 — API 토큰이 다른 참가자에게 전달되지 않음 |

## 정책 충돌 목록

| 충돌 ID | 도메인 A 정책 | 도메인 B 정책 | 설명 | 상태 |
|---|---|---|---|---|
| (없음) | - | - | 정책 충돌 미감지 | - |
