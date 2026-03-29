# 포커 게임 도메인 - 기능 목록
> 최종 갱신: 2026-03-28

---

## poker.방_유효성_검사
- **설명**: 링크로 방에 접근할 때 서버에 방 존재 여부를 확인한다. 방이 없으면 "찾을 수 없음" 화면을 표시하고, 있으면 JoinRoomForm을 렌더링한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (roomValid state, fetch /api/room/${roomId})
  - BE: `app/api/room/[roomId]/route.ts`
  - API: `GET /api/room/[roomId]` → `{ exists: boolean }`
- **주요 엔티티**: PokerState.roomId
- **영향을 줌 (impacts)**:
  - `poker.방_입장_참가자` — 방 존재 확인 시 JoinRoomForm 표시
    - 트리거: roomValid === true
    - 영향 범위: UI 분기 (찾을 수 없음 vs JoinRoomForm)
- **영향을 받음 (affected_by)**:
  - `poker.room_existence_check` — signalingStore.roomExists()로 방 존재 판단
    - 의존 필드: exists boolean
- **변경 시 체크리스트**:
  - [ ] signalingStore.roomExists() 반환 조건 변경 여부 확인
  - [ ] 방 유효하지 않을 때 사용자에게 표시하는 메시지/동작 확인
  - [ ] hydration 완료 전 fetch 방지 조건(`if (!hydrated) return`) 유지 여부 확인

---

## poker.방_입장_참가자
- **설명**: 초대 링크로 진입한 신규 참가자가 이름을 입력하고 방에 참가한다. localStorage에 최근 이름을 캐싱하여 재방문 시 자동 입력한다.
- **코드 위치**:
  - FE: `components/poker/JoinRoomForm.tsx`
  - API: 없음 (joinRoom()은 로컬 스토어 action)
- **주요 엔티티**: Participant, PokerState
- **영향을 줌 (impacts)**:
  - `poker.방_대기_화면` — participants 추가로 대기→게임 전환 조건 변경
    - 트리거: joinRoom() 호출 후 participants.length 변경
    - 영향 범위: 2인 이상 시 게임 시작
- **영향을 받음 (affected_by)**:
  - `poker.방_유효성_검사` — 방이 존재해야 JoinRoomForm이 표시됨
    - 의존 필드: roomValid state
  - `poker.sse_connection` — onPeerConnected 콜백으로 addParticipant() 호출
    - 의존 필드: peerId, name
- **변경 시 체크리스트**:
  - [ ] localStorage 키(`jira-joker-participant-name`) 변경 시 다른 캐싱 로직과 충돌 확인
  - [ ] joinRoom() 호출 후 WebRTC 연결(useWebRTC enabled=true) 조건 확인
  - [ ] SSR 환경에서 localStorage 접근 try/catch 유지 확인

---

## poker.방_대기_화면
- **설명**: 방에 참가자가 2인 미만일 때 게임을 시작하지 않고 대기 화면을 표시한다. 호스트에게는 초대 링크 복사 UI를, 참가자에게는 연결 중 안내를 표시한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (participants.length < 2 분기)
- **주요 엔티티**: Participant[], PokerState.roomId
- **영향을 줌 (impacts)**:
  - (없음 — 수동 대기 화면)
- **영향을 받음 (affected_by)**:
  - `poker.방_입장_참가자` — participants 추가 시 대기 해제
    - 의존 필드: participants.length
  - `poker.sse_connection` — 피어 연결 시 participants 추가됨
    - 의존 필드: onPeerConnected 콜백
- **변경 시 체크리스트**:
  - [ ] 2인 기준 변경 시 isAllVoted 계산식도 함께 검토
  - [ ] 초대 링크 복사 버튼이 모든 브라우저에서 작동하는지 확인

---

## poker.카드_선택
- **설명**: 참가자가 Fibonacci 수열 + 특수값('?', '☕')으로 구성된 카드 덱에서 추정값을 선택한다. 선택 즉시 로컬 상태를 업데이트하고 'voted' 메시지를 다른 참가자에게 브로드캐스트한다.
- **코드 위치**:
  - FE: `components/poker/CardDeck.tsx`, `components/poker/PokerCard.tsx`, `app/room/[roomId]/page.tsx` (handleSelectCard)
- **주요 엔티티**: Participant.hasVoted, PokerState.myVote
- **영향을 줌 (impacts)**:
  - `poker.투표_공개` — allVoted 조건 충족 시 자동 카운트다운 시작
    - 트리거: 마지막 참가자 카드 선택 → participants.every(p => p.hasVoted)
    - 영향 범위: countdown state, phase 'voting' → 'revealed' 전환
- **영향을 받음 (affected_by)**:
  - `poker.투표_공개` — phase가 'revealed'이면 카드 선택 불가(disabled)
    - 의존 필드: PokerState.phase
  - `poker.issues_fetch` — JiraTicket[]이 없으면 투표 대상 없음
    - 의존 필드: PokerState.tickets
  - `poker.game_message_broadcast` — 원격 참가자 voted 메시지 → setParticipantVoted()
    - 의존 필드: DataMessage type 'voted'
  - `poker.재투표` — 투표 초기화 후 카드 재선택 가능
    - 의존 필드: phase 'voting', myVote=null
  - `poker.다음_티켓` — 새 티켓으로 투표 초기화 후 카드 재선택 가능
    - 의존 필드: currentTicketIndex 변경, phase 'voting'
- **변경 시 체크리스트**:
  - [ ] CARD_VALUES 변경 시 mode()/average() 계산 로직에 영향 없는지 확인 (숫자가 아닌 값은 average에서 제외)
  - [ ] 카드 재선택(이미 voted 상태) 시 'voted' 메시지 중복 전송 여부 확인
  - [ ] compact prop 사용처(RoomPage sticky bottom) 레이아웃 확인

---

## poker.투표_공개
- **설명**: 전원 투표 완료를 감지하면 2초 카운트다운 후 자동으로 모든 투표를 공개한다. 본인 투표값을 'reveal' 메시지로 브로드캐스트하고 phase를 'revealed'로 전환한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (isAllVoted, countdown state, Effect 1/2, revealVotes 호출)
- **주요 엔티티**: Participant[].hasVoted, Participant[].vote, PokerState.phase
- **영향을 줌 (impacts)**:
  - `poker.결과_표시` — phase=revealed 전환 → TableCenter에 Mode/Avg 표시
    - 트리거: revealVotes() 호출
    - 영향 범위: phase, 각 Participant.vote 필드 공개
  - `poker.카드_선택` — phase=revealed 시 카드 선택 disabled
    - 트리거: phase 전환
    - 영향 범위: CardDeck disabled prop
- **영향을 받음 (affected_by)**:
  - `poker.카드_선택` — 모든 Participant.hasVoted가 true여야 트리거됨
    - 의존 필드: participants.every(p => p.hasVoted)
  - `poker.game_message_broadcast` — reveal 메시지로 원격 참가자 투표값 동기화
    - 의존 필드: DataMessage type 'reveal', vote 값
- **변경 시 체크리스트**:
  - [ ] 카운트다운 중 참가자 이탈 시 isAllVoted 재계산 → 카운트다운 취소 여부 확인
  - [ ] 2초 카운트다운 시간 변경 시 setCountdown(2) 초기값 수정
  - [ ] 2인 미만 조건(`participants.length >= 2`) 변경 시 방_대기_화면 기준과 일치시키기

---

## poker.결과_표시
- **설명**: 투표가 공개되면 포커 테이블 중앙에 Mode(최빈값)와 Average(숫자 평균)를 표시한다. 호스트에게만 Re-vote / Next 버튼이 활성화된다.
- **코드 위치**:
  - FE: `components/poker/PokerTable.tsx` (TableCenter 컴포넌트)
- **주요 엔티티**: CompletedTicket.result, Participant[].vote
- **영향을 줌 (impacts)**:
  - `poker.재투표` — Re-vote 버튼 활성화 (호스트 전용)
    - 트리거: phase === 'revealed' && isHost
    - 영향 범위: handleReset 호출 가능
  - `poker.다음_티켓` — Next 버튼 활성화 (호스트 전용)
    - 트리거: phase === 'revealed' && isHost && !isLastTicket
    - 영향 범위: handleNext 호출 가능
- **영향을 받음 (affected_by)**:
  - `poker.투표_공개` — phase === 'revealed'일 때만 결과 표시
    - 의존 필드: PokerState.phase, mode(), average()
- **변경 시 체크리스트**:
  - [ ] mode() 계산 로직 변경 시 CompletedTicket.result.mode 기록값도 영향 받음
  - [ ] average() 계산 시 비숫자 값('?', '☕') 제외 로직 유지 확인
  - [ ] "All Done" span(비인터랙티브) → button 변환 필요성 검토 (Jira SP 반영 계획 관련)

---

## poker.재투표
- **설명**: 호스트가 현재 티켓에 대해 투표를 초기화하여 다시 투표할 수 있도록 한다. 'reset' 메시지를 브로드캐스트하여 모든 참가자에게 동기화한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleReset), `components/poker/PokerTable.tsx` (Re-vote 버튼)
- **주요 엔티티**: Participant[], PokerState.phase, PokerState.myVote
- **영향을 줌 (impacts)**:
  - `poker.카드_선택` — 투표 초기화 → 카드 재선택 가능
    - 트리거: resetRound() 호출
    - 영향 범위: phase 'revealed' → 'voting', myVote=null, 전체 participants hasVoted=false
- **영향을 받음 (affected_by)**:
  - `poker.결과_표시` — Re-vote 버튼은 phase === 'revealed' && isHost일 때만 활성
    - 의존 필드: PokerState.phase, isHost()
  - `poker.game_message_broadcast` — reset 메시지로 원격 참가자 동기화
    - 의존 필드: DataMessage type 'reset'
- **변경 시 체크리스트**:
  - [ ] resetRound() 호출 시 completedTickets에 기록이 남지 않음(의도된 동작) 확인
  - [ ] 참가자 측에서 'reset' 메시지 수신 시 자신의 myVote도 초기화되는지 확인

---

## poker.다음_티켓
- **설명**: 호스트가 현재 티켓 결과를 CompletedTicket으로 저장하고 다음 티켓으로 인덱스를 이동한다. 'next' 메시지를 브로드캐스트하여 모든 참가자에게 동기화한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleNext), `components/poker/PokerTable.tsx` (Next 버튼)
- **주요 엔티티**: CompletedTicket, PokerState.currentTicketIndex, PokerState.completedTickets
- **영향을 줌 (impacts)**:
  - `poker.세션_완료` — 마지막 티켓이면 currentTicket() null → 세션 요약 표시
    - 트리거: nextTicket() 호출 후 isLastTicket === true
    - 영향 범위: SessionSummary 렌더링
  - `poker.카드_선택` — 새 티켓으로 투표 상태 초기화 → 카드 재선택 가능
    - 트리거: nextTicket() 내 투표 상태 리셋
    - 영향 범위: currentTicketIndex++, phase 'voting', myVote=null
  - `poker.티켓_패널` — completedTickets에 결과 추가 → TicketHistory 갱신
    - 트리거: nextTicket() 호출
    - 영향 범위: completedTickets[] 추가
- **영향을 받음 (affected_by)**:
  - `poker.결과_표시` — Next 버튼은 phase === 'revealed' && isHost && !isLastTicket일 때만 활성
    - 의존 필드: PokerState.phase, isHost(), isLastTicket()
  - `poker.game_message_broadcast` — next 메시지로 원격 참가자 동기화
    - 의존 필드: DataMessage type 'next'
- **변경 시 체크리스트**:
  - [ ] nextTicket() 내 mode()/average() 호출 시점이 participants 상태 변경 전임을 확인
  - [ ] isLastTicket 판별 후 poker.세션_완료로 화면 전환 조건 확인

---

## poker.세션_완료
- **설명**: 모든 티켓 추정이 완료되면 세션 요약 화면을 표시한다. 완료된 티켓별 Mode/Average 테이블과 총 Story Points 합계를 보여준다.
- **코드 위치**:
  - FE: `components/poker/SessionSummary.tsx`, `app/room/[roomId]/page.tsx` (!ticket && tickets.length > 0 분기)
- **주요 엔티티**: CompletedTicket[], PokerState.tickets
- **영향을 줌 (impacts)**:
  - (없음 — 종료 화면, leaveRoom()으로 세션 정리만 수행)
- **영향을 받음 (affected_by)**:
  - `poker.다음_티켓` — 마지막 티켓 nextTicket() 완료 시 currentTicket()이 null 반환
    - 의존 필드: currentTicket() === null && tickets.length > 0
- **변경 시 체크리스트**:
  - [ ] 총 SP 계산 시 비숫자 mode 값은 0으로 처리되는 것 확인
  - [ ] 세션 종료 버튼 클릭 시 leaveRoom() → sessionStorage 초기화 → '/' 리디렉트 확인
  - [ ] 모바일/데스크톱 레이아웃(table vs card list) 전환 브레이크포인트 확인

---

## poker.티켓_패널
- **설명**: 우측 floating 패널에서 현재 진행 중인 티켓의 상세 정보와 이전 완료 티켓 히스토리를 확인할 수 있다. 토글 버튼으로 패널을 열고 닫을 수 있으며, 모바일에서는 오버레이로 표시된다.
- **코드 위치**:
  - FE: `components/poker/TicketPanel.tsx`, `components/poker/TicketDetail.tsx`, `components/poker/TicketHistory.tsx`, `app/room/[roomId]/page.tsx` (panelOpen state, lg:pr-96 동적 패딩)
- **주요 엔티티**: JiraTicket, CompletedTicket
- **영향을 줌 (impacts)**:
  - (없음 — 읽기 전용 표시 패널)
- **영향을 받음 (affected_by)**:
  - `poker.issues_fetch` — JiraTicket 데이터(description, assignee 등) → TicketDetail 표시
    - 의존 필드: JiraTicket 전체 필드
  - `poker.다음_티켓` — completedTickets 추가 → TicketHistory 갱신
    - 의존 필드: completedTickets[]
- **변경 시 체크리스트**:
  - [ ] 패널 너비(w-96) 변경 시 RoomPage의 lg:pr-96 padding 및 TicketPanel toggle 버튼 위치(right-96) 동기화
  - [ ] 모바일 backdrop 클릭 시 패널 닫힘 동작 확인
  - [ ] ticket이 null이고 totalTickets도 0이면 패널 자체를 렌더링하지 않는 조건 확인

---

## poker.참가자_추방
- **설명**: 호스트가 특정 참가자를 강제 퇴장시킨다. Seat의 hover kick 버튼 클릭 시 'kick' 메시지를 전체 브로드캐스트하고, 대상 참가자는 추방 화면을 표시한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleKick), `components/poker/PokerTable.tsx` (Seat 내 kick 버튼)
- **주요 엔티티**: Participant
- **영향을 줌 (impacts)**:
  - `poker.peer_disconnect` — kick 대상 퇴장 → SSE 정리
    - 트리거: kick 메시지 수신 후 대상 참가자 퇴장
    - 영향 범위: 대상 피어 SSE 종료, participants 제거
- **영향을 받음 (affected_by)**:
  - `poker.game_message_broadcast` — kick 메시지 수신 측에서 퇴장 처리
    - 의존 필드: DataMessage type 'kick', targetId
- **변경 시 체크리스트**:
  - [ ] kick 대상이 이미 투표한 경우 해당 투표가 결과에 남지 않는지 확인 (removeParticipant 즉시 처리)
  - [ ] kick 메시지 수신 측에서 targetId 일치 여부 확인 로직(usePokerStore.getState().myId) 확인

---

## poker.방_종료_및_이탈
- **설명**: 호스트의 방 종료(room_closed 브로드캐스트)와 일반 참가자의 나가기(leaving 브로드캐스트)를 처리한다. beforeunload 이벤트로 탭 닫힘 시에도 sendBeacon으로 서버에 이탈을 알린다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (handleLeaveRoom, beforeunload handler)
- **주요 엔티티**: PokerState (leaveRoom → initialState 리셋)
- **영향을 줌 (impacts)**:
  - `poker.peer_disconnect` — sendBeacon POST → peer_left broadcast
    - 트리거: beforeunload 또는 handleLeaveRoom 실행
    - 영향 범위: 서버 측 peer 제거, 남은 참가자에게 peer_left 전달
- **영향을 받음 (affected_by)**:
  - `poker.game_message_broadcast` — room_closed/leaving 메시지 수신으로 트리거
    - 의존 필드: DataMessage type 'room_closed', 'leaving'
  - `poker.peer_disconnect` — peer_left SSE 이벤트로 참가자 제거
    - 의존 필드: onPeerDisconnected 콜백
- **변경 시 체크리스트**:
  - [ ] 호스트 이탈 전 confirm 다이얼로그가 room_closed 브로드캐스트보다 먼저 실행되는 순서 확인
  - [ ] sendBeacon + broadcast 둘 다 실행되어 중복 peer_left가 발생할 수 있음 → signalingStore.removePeer()의 중복 방지 로직 확인
  - [ ] leaveRoom() 호출 시 sessionStorage 키(`poker-room`) 삭제 확인

---

## poker.호스트_재접속
- **설명**: 호스트가 이탈하면 나머지 참가자에게 대기 오버레이를 표시하고, 같은 이름의 참가자가 재연결되면 자동으로 호스트 권한을 복원한다. 'host_migrated' 메시지로 전체 참가자에게 동기화한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (hostWaiting state, departedHostName, onPeerConnected 이름 매칭)
- **주요 엔티티**: PokerState.hostId, Participant
- **영향을 줌 (impacts)**:
  - (없음 — 호스트 복원 완료 후 정상 게임 진행 복귀)
- **영향을 받음 (affected_by)**:
  - `poker.peer_disconnect` — 호스트 SSE 끊김 감지 → hostWaiting 오버레이
    - 의존 필드: onPeerDisconnected에서 peerId === hostId 매칭
  - `poker.sse_connection` — 새 피어 연결 시 이름 매칭 → host_migrated
    - 의존 필드: onPeerConnected에서 name === departedHostName
  - `poker.game_message_broadcast` — host_migrated 메시지로 hostId 동기화
    - 의존 필드: DataMessage type 'host_migrated', newHostId
- **변경 시 체크리스트**:
  - [ ] 이름 매칭 방식(문자열 완전 일치)의 보안/충돌 리스크 인지
  - [ ] 호스트 대기 중 자신도 나가기 버튼으로 이탈 가능한 경로 확인
  - [ ] setTimeout 500ms 후 host_migrated 브로드캐스트 — 타이밍 경쟁 조건 확인

---

## poker.p2p_연결_및_릴레이
- **설명**: SSE를 통한 WebRTC 시그널링으로 Full Mesh P2P 연결을 수립하고, 8초 내 DataChannel이 열리지 않으면 자동으로 서버 릴레이 모드로 전환한다. ICE candidate 배치 전송 및 버퍼링을 통해 연결 신뢰성을 높인다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts`
  - API: `GET /api/signaling/[roomId]` (SSE 구독), `POST /api/signaling/[roomId]` (시그널링 메시지 / 릴레이 전송 / leave)
- **주요 엔티티**: DataMessage, SyncState
- **영향을 줌 (impacts)**:
  - (없음 — 인프라 레이어, 게임 기능들이 broadcast/sendToPeer를 통해 사용)
- **영향을 받음 (affected_by)**:
  - `poker.sse_connection` — SSE 채널 개설로 시그널링 경로 확보
    - 의존 필드: EventSource 연결 상태
  - `poker.webrtc_negotiation` — SDP 교환으로 DataChannel 개설
    - 의존 필드: RTCPeerConnection 상태
  - `poker.relay_fallback` — P2P 실패 시 서버 릴레이 모드 전환
    - 의존 필드: TransportMode
- **변경 시 체크리스트**:
  - [ ] RELAY_FALLBACK_TIMEOUT(8000ms) 변경 시 UX 영향 확인
  - [ ] 릴레이 모드 전환 후 기존 PeerConnection 정리 로직 확인
  - [ ] ICE candidate 배치 타이밍(100ms 윈도우) 변경 시 연결 성공률 영향 확인
  - [ ] sync_request는 initiator 쪽에서만 전송하는 규칙 유지 (중복 sync 방지)
