# Service Flows

> 최종 갱신: 2026-03-25

## FLOW-001: 방 생성 및 게임 시작

### 참여 도메인
jira, poker, realtime, room

### 흐름

1. **[poker] Jira 인증 및 방 생성**
   - 도메인: poker + jira
   - 기능: poker.방_생성_위저드, jira.인증_검증, jira.에픽_조회, jira.이슈_목록_조회
   - 산출물: PokerState (roomId, hostId, tickets, jiraConfig 초기화)
   - 트리거: 사용자가 홈 페이지에서 3단계 위저드 완료
   - 영향: → room.대기_화면, realtime.SSE_시그널링_연결

2. **[realtime] SSE 시그널링 연결**
   - 도메인: realtime
   - 기능: realtime.SSE_시그널링_연결
   - 산출물: PeerEntry (서버 signalingStore rooms Map에 등록)
   - 트리거: useWebRTC enabled=true (roomId + myName 설정 완료)
   - 영향: → realtime.WebRTC_P2P_협상, room.방_유효성_검사 (rooms Map에 roomId 등록)

3. **[room] 대기 화면**
   - 도메인: room
   - 기능: room.대기_화면
   - 산출물: 초대 링크 공유 UI (호스트)
   - 트리거: participants.length < 2
   - 영향: → 참가자 합류 대기

4. **[room] 참가자 합류**
   - 도메인: room + realtime
   - 기능: room.방_참가, realtime.WebRTC_P2P_협상
   - 산출물: Participant 추가, PeerConn (DataChannel open)
   - 트리거: 초대 링크로 접근한 참가자가 닉네임 입력
   - 영향: → poker.상태_동기화, room.대기_화면 탈출

5. **[poker] 상태 동기화**
   - 도메인: poker + realtime
   - 기능: poker.상태_동기화, realtime.DataChannel_메시지_전송
   - 산출물: SyncState (신규 피어에 전체 게임 상태 전달)
   - 트리거: DataChannel open + sync_request 자동 발행
   - 영향: → poker.투표 (게임 시작 가능 상태)

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (Jira 인증 분기) | Step 2, 3 | Cloud/Server 인증 변경 시 createRoom의 jiraConfig 구조 및 이후 API 호출 유효성 |
| Step 2 (SSE 엔드포인트) | Step 4, 5 | SSE 이벤트 구조 변경 시 피어 발견/연결 흐름 전체 영향 |
| Step 4 (WebRTC 협상) | Step 5 | SDP/ICE 로직 변경 시 DataChannel 성립 및 sync 흐름 정상 동작 여부 |
| Step 5 (SyncState 구조) | 전체 게임 | SyncState 필드 추가/제거 시 applySyncState와 sync_response 생성 코드 양쪽 동시 수정 필수 |

---

## FLOW-002: 투표 → 공개 → 다음 티켓 사이클

### 참여 도메인
poker, realtime

### 흐름

1. **[poker] 카드 선택 (투표)**
   - 도메인: poker
   - 기능: poker.투표
   - 산출물: Participant (hasVoted=true), DataMessage (type: voted)
   - 트리거: 참가자가 CardDeck에서 카드 클릭
   - 영향: → 전원 투표 시 poker.투표_공개

2. **[poker] 전원 투표 완료 → 카운트다운 → Reveal**
   - 도메인: poker + realtime
   - 기능: poker.투표_공개, realtime.DataChannel_메시지_전송
   - 산출물: Participant (vote=실제값), DataMessage (type: reveal)
   - 트리거: participants.every(p => p.hasVoted) && participants.length >= 2
   - 영향: → 호스트 제어 버튼(Re-vote/Next) 활성화

3. **[poker] 호스트 결정: Re-vote 또는 Next**
   - 도메인: poker
   - 기능: poker.재투표 또는 poker.다음_티켓
   - 산출물:
     - Re-vote: 전체 Participant 투표 초기화
     - Next: CompletedTicket 생성, currentTicketIndex 증가
   - 트리거: 호스트가 TableCenter에서 버튼 클릭
   - 영향:
     - Re-vote → Step 1 (같은 티켓 재투표)
     - Next → Step 1 (다음 티켓 투표) 또는 poker.세션_완료

4. **[poker] 세션 완료** (마지막 티켓일 때)
   - 도메인: poker + room
   - 기능: poker.세션_완료
   - 산출물: SessionSummary UI (티켓별 Mode/Average, 총 SP)
   - 트리거: nextTicket 후 currentTicketIndex >= tickets.length
   - 영향: → room.이탈_호스트 (세션 종료 버튼)

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (CARD_VALUES) | Step 2, 3 | 카드 값 변경 시 투표 완료 판정, reveal 값, Mode/Average 계산 모두 영향 |
| Step 2 (카운트다운 시간) | Step 3 | 카운트다운 변경 시 UX 타이밍; reveal DataMessage 발행 시점 변경 |
| Step 3 (nextTicket 로직) | Step 4 | CompletedTicket 생성 로직 변경 시 SessionSummary 데이터 구조 일치 여부 |
| Step 2 (allVoted 조건) | Step 1, 3 | 최소 참가자 수 변경 시 대기 화면 조건(participants.length < 2)과 일관성 필요 |

---

## FLOW-003: 피어 이탈 및 호스트 복원

### 참여 도메인
room, realtime, poker

### 흐름

1. **[room] 피어 이탈 감지**
   - 도메인: room + realtime
   - 기능: room.beforeunload_이탈, realtime.피어_이탈_처리
   - 산출물: peer_left SSE 이벤트 broadcast
   - 트리거: 탭 닫기(sendBeacon) 또는 SSE abort 또는 ICE failed
   - 영향: → 호스트 이탈이면 Step 2, 참가자 이탈이면 Step 4

2. **[room] 호스트 이탈 → 대기 오버레이 표시**
   - 도메인: room
   - 기능: room.호스트_재접속_보호
   - 산출물: hostWaiting=true, 전체 화면 오버레이
   - 트리거: onPeerDisconnected에서 peerId === hostId 확인
   - 영향: → 게임 UI 차단 (오버레이가 z-50으로 가림)

3. **[room] 호스트 재접속 → 복원**
   - 도메인: room + realtime
   - 기능: room.호스트_재접속_보호, realtime.SSE_시그널링_연결
   - 산출물: host_migrated DataMessage broadcast, hostWaiting=false
   - 트리거: 같은 이름의 피어가 onPeerConnected로 연결되면 500ms 후 host_migrated 발행
   - 영향: → 게임 재개 (오버레이 해제, hostId 갱신)

4. **[room] 참가자 이탈 → 목록 갱신**
   - 도메인: room + poker
   - 기능: room.이탈_참가자, realtime.피어_이탈_처리
   - 산출물: removeParticipant 호출
   - 트리거: leaving DataMessage 수신 또는 onPeerDisconnected 콜백
   - 영향: → poker.투표 (participants 감소로 allVoted 재계산)

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (sendBeacon 경로) | Step 2, 4 | leave POST 엔드포인트 변경 시 signaling route.ts type=leave 핸들러 일치 여부 |
| Step 2 (호스트 판별) | Step 3 | hostId 비교 로직 변경 시 host_migrated 발행 조건과 일관성 |
| Step 3 (이름 매칭) | 게임 재개 | 호스트 복원 조건 변경 시 departedHostNameRef 비교 로직 및 setTimeout(500ms) 타이밍 |
| Step 4 (removeParticipant) | poker.투표 | 참가자 제거 시 현재 투표 상태(hasVoted/vote)에 미치는 영향 — 전원 투표 완료 직전 이탈 시 자동 reveal 트리거 가능성 |

---

## FLOW-004: 호스트 능동 종료 및 추방

### 참여 도메인
room, realtime, poker

### 흐름

1. **[room] 호스트 방 종료**
   - 도메인: room
   - 기능: room.이탈_호스트
   - 산출물: DataMessage (type: room_closed)
   - 트리거: 호스트가 "방 종료" 클릭 + window.confirm 확인
   - 영향: → Step 2

2. **[room] 참가자 방 종료 오버레이**
   - 도메인: room
   - 기능: room.방_종료_오버레이
   - 산출물: disconnectReason='host_left', 전체 화면 오버레이
   - 트리거: room_closed DataMessage 수신
   - 영향: → 참가자 홈 이동 시 leaveRoom()

3. **[room] 참가자 추방 (별도 경로)**
   - 도메인: room
   - 기능: room.참가자_추방
   - 산출물: DataMessage (type: kick, targetId)
   - 트리거: 호스트가 PokerTable의 참가자 ✕ 버튼 클릭
   - 영향: → 대상에게 방_종료_오버레이(kicked), 나머지에게 removeParticipant

### 흐름 내 수정 영향 분석

| 수정 지점 | 영향받는 후속 단계 | 확인 사항 |
|---|---|---|
| Step 1 (confirm 다이얼로그) | Step 2 | 확인 절차 변경/제거 시 room_closed 발행 타이밍 변화 |
| Step 2 (disconnectReason) | 홈 이동 | 오버레이에서 leaveRoom 호출 순서와 router.push 순서 |
| Step 3 (kick 대상 선택) | 투표 상태 | kick 후 participants 변화로 allVoted 조건 재계산 필요 |
