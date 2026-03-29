# Service Flows

> 최종 갱신: 2026-03-28

## FLOW-001: 방 생성 및 게임 시작

### 참여 도메인
Jira 연동, 포커 게임, 실시간 통신

### 흐름

1. **[poker] Jira 인증 검증**
   - 도메인: Jira 연동
   - 기능: poker.jira_auth_validate
   - 산출물: JiraConfig (domain, token, email)
   - 트리거: 호스트가 Step 1에서 인증 정보 입력 후 "다음" 클릭
   - 영향: → poker.jira_creds_cache (localStorage 캐싱)

2. **[poker] Epic 검색 및 이슈 조회**
   - 도메인: Jira 연동
   - 기능: poker.epic_search, poker.issues_fetch
   - 산출물: JiraTicket[] (투표 대상 티켓 목록)
   - 트리거: Step 3에서 Epic Key 입력 후 검색
   - 영향: → poker.카드_선택 (createRoom을 통해 tickets 전달)

3. **[poker] 방 생성**
   - 도메인: 포커 게임
   - 기능: poker.카드_선택 (createRoom 호출 시점)
   - 산출물: PokerState (roomId, hostId, tickets, participants)
   - 트리거: "방 만들기" 버튼 클릭 → createRoom(name, jiraConfig, tickets)
   - 영향: → poker.방_대기_화면 (router.push → /room/[roomId])

4. **[poker] SSE 연결 및 P2P 수립**
   - 도메인: 실시간 통신
   - 기능: poker.sse_connection, poker.webrtc_negotiation
   - 산출물: DataChannel (P2P 메시지 경로) 또는 relay mode
   - 트리거: /room/[roomId] 페이지 마운트 → useWebRTC enabled=true
   - 영향: → poker.방_대기_화면 (참가자 2인 이상 시 게임 시작)

5. **[poker] 게임 시작 (첫 투표)**
   - 도메인: 포커 게임
   - 기능: poker.카드_선택
   - 산출물: myVote, Participant.hasVoted=true
   - 트리거: participants.length >= 2 && currentTicket exists
   - 영향: → poker.투표_공개 (allVoted 조건 충족 시)

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (인증 방식 변경) | Step 2, Step 3 | Jira API 헤더(x-jira-domain/email/token) 전달 및 Cloud/Server 분기 |
| Step 2 (이슈 조회 JQL 변경) | Step 3 | createRoom에 전달되는 JiraTicket[] 구조 변경 영향 |
| Step 3 (createRoom 인터페이스 변경) | Step 4, Step 5 | usePokerStore 상태 초기화 + sessionStorage persist 범위 |
| Step 4 (SSE/WebRTC 프로토콜 변경) | Step 5 | 피어 연결 성공 후 sync_request/response 흐름 유지 |

---

## FLOW-002: 투표 라운드 (선택 → 공개 → 다음)

### 참여 도메인
포커 게임, 실시간 통신

### 흐름

1. **[poker] 카드 선택**
   - 도메인: 포커 게임
   - 기능: poker.카드_선택
   - 산출물: myVote 설정, Participant.hasVoted=true
   - 트리거: 참가자가 CardDeck에서 카드 클릭
   - 영향: → poker.game_message_broadcast (voted 메시지 broadcast)

2. **[poker] 투표 상태 동기화**
   - 도메인: 실시간 통신
   - 기능: poker.game_message_broadcast
   - 산출물: 원격 참가자 Participant.hasVoted=true
   - 트리거: voted DataMessage 수신
   - 영향: → poker.투표_공개 (allVoted 조건 체크)

3. **[poker] 자동 투표 공개**
   - 도메인: 포커 게임
   - 기능: poker.투표_공개
   - 산출물: phase='revealed', 각 Participant.vote 공개
   - 트리거: allVoted === true → 2초 카운트다운 완료
   - 영향: → poker.game_message_broadcast (reveal 메시지), → poker.결과_표시

4. **[poker] 결과 표시 및 호스트 제어**
   - 도메인: 포커 게임
   - 기능: poker.결과_표시
   - 산출물: Mode/Avg 표시, Re-vote/Next 버튼 활성화
   - 트리거: phase === 'revealed'
   - 영향: → poker.재투표 또는 → poker.다음_티켓

5. **[poker] 다음 티켓 이동 (또는 재투표)**
   - 도메인: 포커 게임
   - 기능: poker.다음_티켓 (또는 poker.재투표)
   - 산출물: CompletedTicket 기록, currentTicketIndex++, 투표 초기화
   - 트리거: 호스트가 Next (또는 Re-vote) 클릭
   - 영향: → Step 1로 순환 (또는 poker.세션_완료)

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (CARD_VALUES 변경) | Step 3, Step 4 | mode()/average() 계산 시 비숫자 값 제외 로직 유지 |
| Step 2 (DataMessage voted 구조 변경) | Step 3 | onMessage 핸들러에서 voted 파싱 + setParticipantVoted 동시 수정 |
| Step 3 (카운트다운 타이밍 변경) | Step 4 | countdown state 초기값, interval 로직, 0 도달 시 effect 조건 |
| Step 5 (nextTicket 결과 기록 방식 변경) | Step 1 (다음 라운드) | CompletedTicket 구조 변경 시 SessionSummary + TicketHistory 동시 수정 |

---

## FLOW-003: 참가자 입장 및 상태 동기화

### 참여 도메인
포커 게임, 실시간 통신

### 흐름

1. **[poker] 방 유효성 검사**
   - 도메인: 포커 게임, 실시간 통신
   - 기능: poker.방_유효성_검사, poker.room_existence_check
   - 산출물: roomValid state (true/false)
   - 트리거: /room/[roomId] 페이지 마운트 + hydration 완료
   - 영향: → poker.방_입장_참가자 (roomValid === true 시)

2. **[poker] 이름 입력 및 방 참가**
   - 도메인: 포커 게임
   - 기능: poker.방_입장_참가자
   - 산출물: myId, myName, Participant 추가
   - 트리거: JoinRoomForm에서 이름 입력 후 제출
   - 영향: → poker.sse_connection (useWebRTC enabled=true)

3. **[poker] SSE 연결 및 피어 발견**
   - 도메인: 실시간 통신
   - 기능: poker.sse_connection
   - 산출물: 기존 피어 목록, SSE 스트림 개설
   - 트리거: useWebRTC enabled=true + roomId/myId/myName 설정 완료
   - 영향: → poker.webrtc_negotiation (각 피어에 offer 전송)

4. **[poker] P2P DataChannel 수립**
   - 도메인: 실시간 통신
   - 기능: poker.webrtc_negotiation (또는 poker.relay_fallback)
   - 산출물: DataChannel open (또는 relay mode 전환)
   - 트리거: SDP offer/answer 교환 완료 + ICE candidate 적용
   - 영향: → sync_request 전송

5. **[poker] 상태 동기화**
   - 도메인: 실시간 통신, 포커 게임
   - 기능: poker.game_message_broadcast
   - 산출물: SyncState 수신 → applySyncState() 적용
   - 트리거: DataChannel open 시 initiator가 sync_request 전송
   - 영향: → 포커 게임 상태 완전 동기화 (participants, tickets, phase, hostId 등)

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (roomExists 판단 기준 변경) | Step 2 | roomValid false 시 JoinRoomForm 미표시 → 사용자 입장 불가 |
| Step 2 (joinRoom 인터페이스 변경) | Step 3 | myId/myName이 useWebRTC에 정상 전달되는지 확인 |
| Step 3 (SSE 프로토콜 변경) | Step 4 | room_state 이벤트 구조(peers[]) 변경 시 FE 파서 동시 수정 |
| Step 5 (SyncState 구조 변경) | 전체 | applySyncState + sync_response 생성 로직 양방향 수정 필수 |

---

## FLOW-004: 호스트 이탈 및 재접속 복원

### 참여 도메인
실시간 통신, 포커 게임

### 흐름

1. **[poker] 호스트 SSE 끊김 감지**
   - 도메인: 실시간 통신
   - 기능: poker.peer_disconnect
   - 산출물: peer_left 이벤트 broadcast
   - 트리거: 호스트 탭 닫기(abort) 또는 네트워크 끊김
   - 영향: → poker.호스트_재접속 (hostWaiting 오버레이)

2. **[poker] 참가자 대기 오버레이 표시**
   - 도메인: 포커 게임
   - 기능: poker.호스트_재접속
   - 산출물: hostWaiting=true, departedHostName 저장
   - 트리거: onPeerDisconnected에서 peerId === hostId 매칭
   - 영향: → UI 블로킹 (게임 진행 불가)

3. **[poker] 호스트 재접속 (SSE + P2P 재수립)**
   - 도메인: 실시간 통신
   - 기능: poker.sse_connection, poker.webrtc_negotiation
   - 산출물: 새 peerId로 SSE 재연결, DataChannel 재수립
   - 트리거: 호스트가 같은 /room/[roomId]에 재접근
   - 영향: → poker.호스트_재접속 (이름 매칭)

4. **[poker] 호스트 권한 복원**
   - 도메인: 포커 게임
   - 기능: poker.호스트_재접속
   - 산출물: hostId 갱신, host_migrated broadcast
   - 트리거: onPeerConnected에서 name === departedHostName 매칭 (500ms delay)
   - 영향: → poker.game_message_broadcast (host_migrated → 전체 참가자 hostId 갱신)

5. **[poker] 게임 재개**
   - 도메인: 포커 게임
   - 기능: poker.카드_선택 (또는 현재 phase에 맞는 기능)
   - 산출물: 정상 게임 진행 복귀
   - 트리거: hostWaiting=false, 모든 참가자 hostId 동기화 완료
   - 영향: → 정상 투표 라운드 진행

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (peer_left 감지 방식 변경) | Step 2 | onPeerDisconnected 콜백 + hostId 매칭 로직 |
| Step 2 (대기 오버레이 조건 변경) | Step 4 | hostWaiting/departedHostName 상태 관리 |
| Step 3 (SSE 재연결 시 peerId 변경) | Step 4, Step 5 | 새 peerId와 기존 hostId 불일치 → 이름 매칭 필수 |
| Step 4 (host_migrated 메시지 구조 변경) | Step 5 | migrateHost() + 전체 참가자 onMessage 핸들러 동시 수정 |
