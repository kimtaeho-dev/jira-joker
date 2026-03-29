# 정책 카탈로그

> 최종 갱신: 2026-03-29

## 요약

| 도메인 | 정책 수 | 에러 시나리오 수 |
|---|---|---|
| Jira 연동 | 20 | 8 |
| 실시간 통신 | 22 | 4 |
| 포커 게임 | 39 | 3 |
| **합계** | **81** | **15** |

## 도메인별 정책 색인

### Jira 연동 (jira-integration)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-001 | Cloud 모드에서 도메인·이메일·토큰 세 가지 필수 입력 | poker.jira_auth_validate | validation |
| POL-002 | Server·DC 모드에서 도메인·토큰 두 가지 필수 입력 | poker.jira_auth_validate | validation |
| POL-003 | 프록시 API는 자격증명 헤더 없으면 요청 거부 | poker.jira_auth_validate | validation |
| POL-004 | 인증 성공 시에만 자격증명을 로컬 저장소에 캐싱 | poker.jira_auth_validate | validation |
| POL-005 | 이메일 유무에 따라 API v3/v2 및 인증 방식 자동 분기 | poker.jira_auth_validate | 설정값 |
| POL-006 | 도메인 URL에 https:// 자동 부여 및 끝 슬래시 제거 | poker.jira_auth_validate | 설정값 |
| POL-007 | 서버는 인증 정보를 보관하지 않음 (매 요청 헤더 전달) | poker.jira_auth_validate | 설정값 |
| POL-008 | 닉네임 필수 입력 (공백만 입력 시 미입력 처리) | poker.jira_creds_cache | validation |
| POL-009 | 닉네임은 기존 자격증명에 병합하여 저장 | poker.jira_creds_cache | 상태 전이 |
| POL-010 | 저장된 자격증명 삭제 시 폼 전체 초기화 | poker.jira_creds_cache | 상태 전이 |
| POL-011 | 인증 정보(토큰 포함) 평문 저장 | poker.jira_creds_cache | 설정값 |
| POL-012 | Epic Key 미입력 시 검색 비활성 | poker.epic_search | validation |
| POL-013 | 입력한 이슈가 Epic 타입이 아니면 오류 반환 | poker.epic_search | validation |
| POL-014 | Epic Key 변경 시 이전 검색 결과 자동 초기화 | poker.epic_search | validation |
| POL-015 | Epic 확인 성공 후 하위 이슈 자동 연속 조회 | poker.epic_search | validation |
| POL-016 | 하위 이슈 0건이면 방 만들기 차단 | poker.issues_fetch | validation |
| POL-017 | 한 Epic 하위 이슈 최대 100건 조회 | poker.issues_fetch | 설정값 |
| POL-018 | Story Points는 Jira Cloud 커스텀 필드(10016)에서 읽음 | poker.issues_fetch | 설정값 |
| POL-019 | Cloud·Server·DC 이슈 조회 방식 자동 분기 | poker.issues_fetch | 설정값 |
| POL-020 | Cloud 이슈 설명(ADF)을 평문으로 자동 변환 | poker.issues_fetch | 설정값 |

### 실시간 통신 (realtime-communication)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-001 | SSE 연결 시 참가자 식별자와 이름 필수 | poker.sse_connection | validation |
| POL-002 | 입장 즉시 기존 참가자 목록 수신 | poker.sse_connection | 상태 전이 |
| POL-003 | 신규 참가자 진입 시 기존 참가자 전원 알림 | poker.sse_connection | 상태 전이 |
| POL-004 | SSE 하트비트 15초 주기 전송 | poker.sse_connection | 설정값 |
| POL-005 | Offer 발신 주체는 항상 신규 진입 참가자 | poker.webrtc_negotiation | validation |
| POL-006 | Offer 도착 전 ICE candidate 버퍼링 | poker.webrtc_negotiation | validation |
| POL-007 | ICE candidate 100ms 배치 전송 | poker.webrtc_negotiation | 설정값 |
| POL-008 | STUN 서버 3개 병렬 사용 | poker.webrtc_negotiation | 설정값 |
| POL-009 | P2P 연결 실패 시 8초 후 서버 릴레이 자동 전환 | poker.relay_fallback | 상태 전이 |
| POL-010 | P2P DataChannel 개통 시 릴레이 전환 타이머 취소 | poker.relay_fallback | 상태 전이 |
| POL-011 | 릴레이 모드 전환 시 기존 PeerConnection 즉시 정리 | poker.relay_fallback | 상태 전이 |
| POL-012 | 릴레이 모드 중복 활성화 방지 | poker.relay_fallback | 상태 전이 |
| POL-013 | 릴레이 모드에서 신규 참가자 WebRTC 협상 생략 | poker.relay_fallback | validation |
| POL-014 | 릴레이 전환 시 신규 진입 참가자만 동기화 요청 | poker.relay_fallback | validation |
| POL-015 | 피어 퇴장 중복 알림 방지 | poker.peer_disconnect | 상태 전이 |
| POL-016 | 마지막 참가자 퇴장 시 방 자동 소멸 | poker.peer_disconnect | 상태 전이 |
| POL-017 | ICE 연결 실패 즉시 참가자 해제 | poker.peer_disconnect | 상태 전이 |
| POL-018 | 방 존재 여부는 활성 SSE 연결 기준으로 판단 | poker.room_existence_check | validation |
| POL-019 | P2P 모드에서 열린 DataChannel에만 전송 | poker.game_message_broadcast | validation |
| POL-020 | 브로드캐스트는 발신자 본인 제외 | poker.game_message_broadcast | validation |
| POL-021 | 닫힌 SSE 스트림 전송 오류 무시 | poker.game_message_broadcast | validation |
| POL-022 | 릴레이 POST 수신자 지정 여부에 따른 전달 범위 분기 | poker.game_message_broadcast | validation |

### 포커 게임 (poker-game)

| 정책 ID | 규칙 요약 | 관련 기능 | 분류 |
|---|---|---|---|
| POL-001 | 신규 접근자는 서버에서 방 존재 여부 확인 | poker.방_유효성_검사 | validation |
| POL-002 | 이미 입장한 사용자는 서버 재확인 생략 | poker.방_유효성_검사 | validation |
| POL-003 | 상태 복원 완료 전 방 검사 수행 금지 | poker.방_유효성_검사 | validation |
| POL-004 | 이름 공백 입력 차단 | poker.방_입장_참가자 | validation |
| POL-005 | 이름 앞뒤 공백 자동 제거 | poker.방_입장_참가자 | validation |
| POL-006 | 최근 입력 이름 자동 캐싱 | poker.방_입장_참가자 | validation |
| POL-007 | 동일 참가자 중복 등록 방지 | poker.방_입장_참가자 | validation |
| POL-008 | 2인 미만 시 게임 진행 차단, 대기 화면 표시 | poker.방_대기_화면 | 상태 전이 |
| POL-009 | 호스트와 참가자에게 다른 대기 화면 표시 | poker.방_대기_화면 | 상태 전이 |
| POL-010 | 카드 덱 Fibonacci 수열 + 특수값 9장 고정 | poker.카드_선택 | 설정값 |
| POL-011 | 투표 공개 이후 카드 선택 불가 | poker.카드_선택 | validation |
| POL-012 | 전원 투표 완료 및 2인 이상 시 자동 공개 시작 | poker.투표_공개 | 상태 전이 |
| POL-013 | 카운트다운 중 조건 미충족 시 취소 | poker.투표_공개 | 상태 전이 |
| POL-014 | 전원 투표 완료 후 2초 카운트다운 | poker.투표_공개 | 설정값 |
| POL-015 | 투표값 없을 시 '?'로 공개 | poker.투표_공개 | validation |
| POL-016 | Mode 계산 — 최초 최빈값 우선 | poker.결과_표시 | 설정값 |
| POL-017 | Average 계산 — 숫자 투표만 포함 | poker.결과_표시 | 설정값 |
| POL-018 | 결과 화면 컨트롤은 호스트 전용 | poker.결과_표시 | 권한 |
| POL-019 | 마지막 티켓에서는 Next 버튼 미표시 | poker.결과_표시 | validation |
| POL-020 | 재투표 시 현재 라운드만 초기화, 완료 이력 보존 | poker.재투표 | 상태 전이 |
| POL-021 | 재투표는 호스트만 실행 가능 | poker.재투표 | 권한 |
| POL-022 | 다음 티켓 이동 시 현재 결과를 불변 스냅샷으로 기록 | poker.다음_티켓 | 상태 전이 |
| POL-023 | 결과 계산 순서 보장 — 스냅샷 먼저, 초기화 나중 | poker.다음_티켓 | 상태 전이 |
| POL-024 | 다음 티켓 이동은 호스트 전용, 마지막 티켓 제외 | poker.다음_티켓 | 권한 |
| POL-025 | 마지막 티켓 완료 후 세션 완료 화면 전환 | poker.세션_완료 | 상태 전이 |
| POL-026 | 총 스토리 포인트 — 비숫자 Mode는 0 처리 | poker.세션_완료 | 설정값 |
| POL-027 | 세션 종료 시 로컬 상태 전체 초기화 | poker.세션_완료 | validation |
| POL-028 | 티켓이 없으면 패널 미렌더링 | poker.티켓_패널 | 상태 전이 |
| POL-029 | 추방은 호스트만 가능, 자기 자신 제외 | poker.참가자_추방 | 권한 |
| POL-030 | 호스트 방 종료 전 확인 다이얼로그 표시 | poker.방_종료_및_이탈 | validation |
| POL-031 | 호스트 방 종료 시 모든 참가자 연결 종료 | poker.방_종료_및_이탈 | 상태 전이 |
| POL-032 | 탭 닫힘 시 서버와 P2P 양쪽으로 이탈 알림 전송 | poker.방_종료_및_이탈 | 상태 전이 |
| POL-033 | 호스트 이탈 시 참가자에게 무기한 대기 오버레이 표시 | poker.호스트_재접속 | 상태 전이 |
| POL-034 | 이름 완전 일치로 호스트 권한 자동 복원 | poker.호스트_재접속 | 상태 전이 |
| POL-035 | 호스트 복원 브로드캐스트 500ms 지연 전송 | poker.호스트_재접속 | 설정값 |
| POL-036 | WebRTC P2P 실패 시 서버 릴레이 자동 전환 | poker.p2p_연결_및_릴레이 | 상태 전이 |
| POL-037 | P2P 연결 폴백 대기 시간 — 8초 | poker.p2p_연결_및_릴레이 | 설정값 |
| POL-038 | 신규 참가자만 상태 동기화 요청 전송 | poker.p2p_연결_및_릴레이 | validation |
| POL-039 | 동기화 수신 시 자신의 투표 상태 유지 | poker.p2p_연결_및_릴레이 | validation |

## 공통 정책 (Cross-Domain)

| 정책 ID | 규칙 요약 | 적용 도메인 | 비고 |
|---|---|---|---|
| COMMON-001 | P2P 연결 실패 시 8초 후 서버 릴레이 자동 전환, 비가역 | 실시간 통신, 포커 게임 | 실시간 통신 POL-009 + 포커 게임 POL-036/037 — 동일 정책이 통신 인프라와 게임 양쪽에서 기술 |
| COMMON-002 | 신규 참가자만 상태 동기화 요청 전송, 기존 참가자는 요청 안 함 | 실시간 통신, 포커 게임 | 실시간 통신 POL-014 + 포커 게임 POL-038 — 동기화 방향 정책이 양쪽 도메인에서 동일하게 적용 |
| COMMON-003 | 피어 퇴장 중복 알림 방지 (서버 + 클라이언트 이중 경로) | 실시간 통신, 포커 게임 | 실시간 통신 POL-015 + 포커 게임 POL-032 — 서버 측 중복 제거와 클라이언트 이중 전송이 쌍으로 동작 |
| COMMON-004 | 호스트만 게임 진행 제어 가능 (Re-vote, Next, 추방, 방 종료) | 포커 게임 전역 | 포커 게임 POL-018/021/024/029/030 — 호스트 전용 권한 정책이 5개 기능에 공통 적용 |
