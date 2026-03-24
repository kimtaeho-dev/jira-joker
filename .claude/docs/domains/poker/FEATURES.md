# 포커 게임 도메인 - 기능 목록

> 최종 갱신: 2026-03-25

---

## poker.방_생성_위저드

- **설명**: Jira 인증(Cloud/Server·DC 선택) → 닉네임 입력 → Epic 지정 및 이슈 목록 로드의 3단계 위저드를 통해 Planning Poker 방을 생성하고 `/room/[roomId]`로 이동한다.
- **코드 위치**:
  - FE: `app/page.tsx`, `components/poker/CreateRoomWizard.tsx`
  - API: `GET /api/jira?type=myself` (인증 검증), `GET /api/jira?type=epic` (Epic 조회), `GET /api/jira?type=issues` (이슈 목록)
- **주요 엔티티**: JiraConfig, JiraTicket, PokerState
- **영향을 줌 (impacts)**:
  - `room.대기_화면` — 방 생성 완료 후 `/room/[roomId]`로 라우팅되어 대기 화면 진입
    - 트리거: `createRoom(name, jiraConfig, tickets)` 호출 후 `router.push('/room/' + roomId)`
    - 영향 범위: PokerState 초기화 (roomId, myId, hostId, tickets, participants 설정)
  - `realtime.SSE_시그널링_연결` — roomId 확정 후 SSE 연결 활성화
    - 트리거: RoomPage에서 `storeRoomId === roomId` 조건 충족 시 `useWebRTC` enabled=true
    - 영향 범위: SSE 연결 개시, 피어 발견 시 PeerConnection 생성
- **영향을 받음 (affected_by)**:
  - `jira.에픽_조회` — Epic 유효성 검증 후 이슈 조회 흐름 시작; foundEpic 상태가 이슈 목록 조회의 전제 조건
    - 의존 필드: epicKey, foundEpic (CreateRoomWizard 상태)
  - `jira.이슈_목록_조회` — 조회된 JiraTicket 배열이 createRoom의 tickets 인자로 전달됨
    - 의존 필드: JiraTicket[] (조회 결과)
- **변경 시 체크리스트**:
  - [ ] Jira Cloud/Server 인증 분기 변경 시 → `/api/jira` route.ts의 authHeader/apiVersion 분기와 일치하는지 확인
  - [ ] Step3 Epic 검색 API 변경 시 → `type=epic` 및 `type=issues` 응답 매핑(JiraTicket 필드)이 여전히 유효한지 확인
  - [ ] localStorage 캐싱 키(`jira-joker-credentials`) 변경 시 → CreateRoomWizard의 load/save 로직과 JoinRoomForm의 `jira-joker-participant-name` 키와 충돌 여부 확인

---

## poker.투표

- **설명**: 활성화된 티켓에 대해 참가자가 Fibonacci 카드(1,2,3,5,8,13,21,?,☕) 중 하나를 선택하여 투표한다. 투표 완료 사실(값 제외)을 DataChannel로 브로드캐스트한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (`handleSelectCard`), `components/poker/CardDeck.tsx`, `components/poker/PokerCard.tsx`
- **주요 엔티티**: PokerState, Participant, DataMessage
- **영향을 줌 (impacts)**:
  - `poker.투표_공개` — 전원 투표 완료(`isAllVoted`) 시 2초 카운트다운 자동 시작
    - 트리거: 마지막 참가자의 투표로 `participants.every(p => p.hasVoted)` 충족 시
    - 영향 범위: countdown 상태 2로 설정 → 1초마다 감소 → 0에서 revealVotes + reveal 브로드캐스트
- **영향을 받음 (affected_by)**:
  - `poker.재투표` — resetRound 후 다시 투표 단계 진입
    - 의존 필드: PokerState.phase='voting', Participant.hasVoted=false
  - `poker.다음_티켓` — nextTicket 후 새 티켓에 대해 투표 단계 재시작
    - 의존 필드: PokerState.currentTicketIndex, PokerState.phase='voting'
  - `poker.상태_동기화` — sync_response 수신 시 현재 투표 상태 덮어쓰기(자신 투표값은 보존)
    - 의존 필드: SyncState.phase, SyncState.participants
  - `realtime.DataChannel_메시지_전송` — voted/reveal/reset/next DataMessage 수신 시 handleDataMessage를 통해 상태 갱신
    - 의존 필드: DataMessage.type, DataMessage.from
  - `room.참가자_추방` — removeParticipant로 participants 감소 → allVoted 조건 재계산
    - 의존 필드: participants 배열 크기
  - `realtime.피어_이탈_처리` — onPeerDisconnected로 removeParticipant → 동일 영향
    - 의존 필드: participants 배열 크기
- **변경 시 체크리스트**:
  - [ ] 카드 값 목록(`CARD_VALUES`) 변경 시 → CardDeck.tsx, PokerCard.tsx, `isNaN(Number(vote))` 처리(average 계산)도 함께 확인
  - [ ] 투표 브로드캐스트 시점(현재 selectCard 호출 직후) 변경 시 → `voted` DataMessage의 from 필드 및 수신 측 setParticipantVoted 로직 확인

---

## poker.투표_공개

- **설명**: 전원 투표 완료 후 2초 카운트다운을 거쳐 자동으로 reveal한다. 각 참가자가 자신의 실제 카드 값을 `reveal` DataMessage로 브로드캐스트하여 전체 공개. Mode(최빈값)와 Average를 테이블 중앙에 표시한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (countdown Effect 1/2, `handleSelectCard`), `components/poker/PokerTable.tsx` (TableCenter)
- **주요 엔티티**: PokerState, Participant, DataMessage
- **영향을 줌 (impacts)**:
  - `poker.재투표` / `poker.다음_티켓` — revealed 상태에서만 호스트에게 Re-vote/Next 버튼 활성화
    - 트리거: PokerState.phase='revealed' 진입 시
    - 영향 범위: TableCenter UI에 결과 + 호스트 제어 버튼 노출
- **영향을 받음 (affected_by)**:
  - `poker.투표` — 전원 투표 완료가 트리거
    - 의존 필드: Participant.hasVoted (전체 true), participants.length >= 2
- **변경 시 체크리스트**:
  - [ ] 카운트다운 시간(현재 2초) 변경 시 → Effect 1의 초기 setCountdown(2) 값 및 interval 로직 함께 변경
  - [ ] reveal 브로드캐스트 조건 변경 시 → `countdown === 0` Effect와 `reveal` DataMessage 수신 측 `setParticipantVote` 로직 일관성 확인
  - [ ] Mode/Average 계산 로직 변경 시 → usePokerStore의 `mode()`, `average()` 파생 함수 및 CompletedTicket.result 저장 로직 함께 변경

---

## poker.재투표

- **설명**: 투표 공개 후 결과에 이의가 있을 때 호스트가 같은 티켓을 재투표한다. 모든 참가자의 투표 상태를 초기화하고 다시 voting 단계로 진입한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (`handleReset`), `components/poker/PokerTable.tsx` (TableCenter "Re-vote" 버튼)
- **주요 엔티티**: PokerState, Participant, DataMessage
- **영향을 줌 (impacts)**:
  - `poker.투표` — resetRound 후 모든 참가자가 다시 투표 가능 상태로 전환
    - 트리거: `handleReset` 호출 → `resetRound()` + `broadcast({type:'reset'})` 실행
    - 영향 범위: PokerState.phase='voting', PokerState.myVote=null, Participant.hasVoted=false, Participant.vote=undefined (전체)
- **영향을 받음 (affected_by)**:
  - `poker.투표_공개` — revealed 상태일 때만 Re-vote 버튼 접근 가능
    - 의존 필드: PokerState.phase='revealed', isHost()=true
- **변경 시 체크리스트**:
  - [ ] resetRound 스토어 액션 변경 시 → `reset` DataMessage 수신 측 `resetRound()` 호출과 대칭성 확인
  - [ ] 호스트 전용 제한 변경 시 → TableCenter의 `isHost` prop 조건 및 RoomPage의 `handleReset` 노출 조건 확인

---

## poker.다음_티켓

- **설명**: 호스트가 현재 티켓의 투표 결과를 completedTickets에 기록하고 다음 티켓으로 진행한다. 마지막 티켓이면 세션 완료 화면으로 전환한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (`handleNext`), `components/poker/PokerTable.tsx` (TableCenter "Next →" / "All Done" 표시)
- **주요 엔티티**: PokerState, CompletedTicket, JiraTicket, DataMessage
- **영향을 줌 (impacts)**:
  - `poker.세션_완료` — 마지막 티켓 완료 시 `currentTicket()` 반환 null → SessionSummary 렌더링
    - 트리거: `nextTicket()` 호출로 `currentTicketIndex >= tickets.length` 조건 충족 시
    - 영향 범위: completedTickets 최종 목록이 SessionSummary 및 TicketHistory에 반영
  - `poker.투표` — 다음 티켓으로 투표 단계 재시작
    - 트리거: `nextTicket()` 호출 → phase='voting', myVote=null, participants 초기화
    - 영향 범위: 새 currentTicketIndex의 티켓 표시, 카드덱 활성화
  - `poker.티켓_패널` — currentTicketIndex 증가 → TicketDetail에 새 티켓 표시
    - 트리거: nextTicket 완료 후 PokerState.currentTicketIndex 변경
    - 영향 범위: TicketDetail 티켓 내용 및 진행 표시(N/total) 갱신
- **영향을 받음 (affected_by)**:
  - `poker.투표_공개` — revealed 상태일 때만 Next 버튼 접근 가능
    - 의존 필드: PokerState.phase='revealed', isHost()=true, isLastTicket()=false
- **변경 시 체크리스트**:
  - [ ] nextTicket 스토어 액션 변경 시 → `next` DataMessage 수신 측 `nextTicket()` 호출과 대칭성 확인
  - [ ] CompletedTicket 생성 로직 변경 시 → SessionSummary, TicketHistory의 데이터 구조 접근도 함께 확인
  - [ ] "All Done" 표시 조건(`isLastTicket()`) 변경 시 → PokerState.isLastTicket() 구현(`currentTicketIndex >= tickets.length - 1`)과 일치하는지 확인

---

## poker.티켓_패널

- **설명**: 화면 우측에 고정되는 float 패널. 현재 티켓의 key, summary, description을 표시하고, 완료된 티켓 이력(TicketHistory)을 접을 수 있는 형태로 보여준다. 토글 버튼으로 열기/닫기 가능하며, 닫히면 메인 콘텐츠가 전체 너비를 사용한다.
- **코드 위치**:
  - FE: `components/poker/TicketPanel.tsx`, `components/poker/TicketDetail.tsx`, `components/poker/TicketHistory.tsx`
- **주요 엔티티**: JiraTicket, CompletedTicket
- **영향을 줌 (impacts)**:
  - (없음 — 패널은 읽기 전용 표시 컴포넌트이며 게임 상태를 변경하지 않음. 레이아웃 패딩 변경은 CSS 수준)
- **영향을 받음 (affected_by)**:
  - `poker.다음_티켓` — nextTicket 호출로 currentTicketIndex 변경 → TicketDetail 내용 갱신
    - 의존 필드: JiraTicket.key, JiraTicket.summary, JiraTicket.description
  - `poker.상태_동기화` — sync_response의 currentTicketIndex 적용 → 신규 참가자에게 현재 티켓 표시
    - 의존 필드: SyncState.currentTicketIndex
- **변경 시 체크리스트**:
  - [ ] 패널 너비(현재 `w-96`) 변경 시 → RoomPage의 `lg:pr-96`, TicketPanel의 `right-96` 토글 버튼 위치도 함께 변경
  - [ ] TicketHistory 노출 조건 변경 시 → `completedTickets.length === 0` 가드 로직 확인

---

## poker.세션_완료

- **설명**: 모든 티켓 투표가 완료되어 `currentTicket()` 반환값이 null이 되면 SessionSummary 화면을 표시한다. 티켓별 투표 결과(Mode/Average) 테이블과 총 SP 합산을 보여주고, 세션 종료 버튼으로 방을 나간다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (`!ticket && tickets.length > 0` 분기), `components/poker/SessionSummary.tsx`
- **주요 엔티티**: CompletedTicket, JiraTicket, PokerState
- **영향을 줌 (impacts)**:
  - `room.이탈_호스트` — 세션 종료 버튼 클릭 시 `onLeave(handleLeaveRoom)` 호출
    - 트리거: SessionSummary의 "세션 종료" 버튼 클릭
    - 영향 범위: leaveRoom() 실행 → PokerState 초기화 → router.push('/')
- **영향을 받음 (affected_by)**:
  - `poker.다음_티켓` — 마지막 nextTicket 호출 후 조건 충족 시 자동 전환
    - 의존 필드: PokerState.currentTicketIndex >= PokerState.tickets.length, PokerState.completedTickets
- **변경 시 체크리스트**:
  - [ ] 총 SP 계산 로직(현재 mode 값이 숫자인 것만 합산) 변경 시 → SessionSummary의 `reduce` 로직 및 `isNaN(Number(ct.result.mode))` 처리 확인
  - [ ] 세션 완료 조건(`!ticket && tickets.length > 0`) 변경 시 → 마지막 티켓에서 "All Done" 표시 연결(isLastTicket)과 일관성 확인

---

## poker.상태_동기화

- **설명**: 신규 피어가 DataChannel(또는 릴레이)을 통해 `sync_request`를 발행하면 기존 피어가 `sync_response`로 전체 PokerState 스냅샷(SyncState)을 전달한다. 수신자는 `applySyncState`로 자신의 투표 상태를 보존하면서 나머지 상태를 동기화한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (`handleDataMessage`의 sync_request/sync_response case), `hooks/useWebRTC.ts` (sync_request 자동 발행)
- **주요 엔티티**: SyncState, PokerState, DataMessage
- **영향을 줌 (impacts)**:
  - `poker.투표` — 동기화 후 participants, phase, currentTicketIndex가 기존 게임 상태로 업데이트
    - 트리거: `applySyncState` 완료 시
    - 영향 범위: 신규 참가자가 현재 투표 진행 상황을 즉시 반영
  - `poker.티켓_패널` — 동기화 후 currentTicketIndex 반영으로 TicketDetail 업데이트
    - 트리거: SyncState.currentTicketIndex 적용
    - 영향 범위: 신규 참가자에게 현재 티켓 표시
- **영향을 받음 (affected_by)**:
  - `realtime.DataChannel_메시지_전송` — DataChannel/릴레이를 통해 sync_request/sync_response 메시지 전달
    - 의존 필드: DataMessage.type='sync_request'/'sync_response'
- **변경 시 체크리스트**:
  - [ ] SyncState 구조 변경(필드 추가/제거) 시 → `applySyncState` 스토어 액션, sync_request 응답 생성 코드(`storeRef.current`) 모두 함께 변경
  - [ ] 자신의 투표 보존 로직(`myParticipant` 유지) 변경 시 → 동기화 후 myVote와 participants의 자신 항목 불일치 가능성 검토
