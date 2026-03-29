# poker-game 비즈니스 규칙 추출 결과

---

## 정책

### poker.방_유효성_검사 관련 정책

- POL-001: 방 존재 여부 서버 확인
  - 조건 (코드 원문): `fetch('/api/room/${roomId}').then(data => setRoomValid(data.exists))`; `roomExists(roomId)` = `rooms.has(roomId)`
  - 조건 (비즈니스 번역): 링크로 방에 접근하는 신규 사용자는 반드시 서버에 방 존재 여부를 확인한다. 서버 메모리에 해당 방이 없으면 유효하지 않은 방으로 처리한다.
  - 위반 시: "방을 찾을 수 없습니다 / 존재하지 않거나 이미 종료된 방입니다." 화면 표시, 홈 복귀 버튼만 노출
  - 코드 근거: app/room/[roomId]/page.tsx:77-88, app/api/room/[roomId]/route.ts:8-14, lib/signalingStore.ts

- POL-002: 이미 입장한 사용자는 서버 재확인 생략
  - 조건 (코드 원문): `if (myName && storeRoomId === roomId) { setRoomValid(true); return }`
  - 조건 (비즈니스 번역): 세션 스토리지에 이름과 방 ID가 저장된 사용자(이미 방에 들어온 사용자)는 서버 재확인 없이 즉시 방으로 진입한다.
  - 위반 시: 해당 없음 (우회 경로)
  - 코드 근거: app/room/[roomId]/page.tsx:80-83

- POL-003: hydration 완료 전 방 검사 수행 금지
  - 조건 (코드 원문): `if (!hydrated) return`
  - 조건 (비즈니스 번역): 브라우저 세션 스토리지에서 상태 복원이 완료되기 전에는 방 유효성 검사를 시작하지 않는다. 복원 전 로딩 화면을 표시한다.
  - 위반 시: SSR/클라이언트 hydration 불일치 오류 발생 가능
  - 코드 근거: app/room/[roomId]/page.tsx:79

---

### poker.방_입장_참가자 관련 정책

- POL-004: 이름 공백 입력 차단
  - 조건 (코드 원문): `if (!name.trim()) return`
  - 조건 (비즈니스 번역): 이름에 공백만 입력하거나 빈 칸으로 입장 시도하면 입장이 차단된다. 버튼도 비활성 상태(`disabled={!name.trim()}`)로 표시된다.
  - 위반 시: 참여하기 버튼이 비활성화되며 joinRoom() 호출되지 않음
  - 코드 근거: components/poker/JoinRoomForm.tsx:38-39, 81-84

- POL-005: 이름 앞뒤 공백 제거 저장
  - 조건 (코드 원문): `joinRoom(name.trim(), roomId)`, `localStorage.setItem(PARTICIPANT_NAME_KEY, name.trim())`
  - 조건 (비즈니스 번역): 입력된 이름은 앞뒤 공백을 제거한 후 저장된다.
  - 위반 시: 해당 없음 (항상 trim 적용)
  - 코드 근거: components/poker/JoinRoomForm.tsx:40-44

- POL-006: 최근 입력 이름 자동 캐싱
  - 조건 (코드 원문): `localStorage.getItem('jira-joker-participant-name')`, `localStorage.setItem('jira-joker-participant-name', name.trim())`
  - 조건 (비즈니스 번역): 참가자가 이름을 입력하면 브라우저 로컬 스토리지에 저장된다. 다음 방문 시 저장된 이름이 자동으로 입력 필드에 채워진다.
  - 위반 시: 프라이빗 모드 또는 로컬 스토리지 비활성 환경에서는 자동 입력 없이 빈 칸으로 표시 (try/catch로 무시)
  - 코드 근거: components/poker/JoinRoomForm.tsx:19-26, 39-44

- POL-007: 중복 참가자 등록 방지
  - 조건 (코드 원문): `if (state.participants.some((x) => x.id === p.id)) return {}`
  - 조건 (비즈니스 번역): 동일한 ID를 가진 참가자는 중복으로 추가되지 않는다.
  - 위반 시: 중복 addParticipant 호출 시 상태 변경 없이 무시
  - 코드 근거: store/usePokerStore.ts:193-196

---

### poker.방_대기_화면 관련 정책

- POL-008: 2인 미만 시 게임 진행 차단
  - 조건 (코드 원문): `participants.length < 2` → 대기 화면 표시
  - 조건 (비즈니스 번역): 방에 참가자가 2명 미만이면 포커 테이블과 카드덱을 표시하지 않고 대기 화면을 표시한다. 게임은 참가자가 2명 이상이어야 시작된다.
  - 위반 시: 해당 없음 (대기 화면으로 대체됨)
  - 코드 근거: app/room/[roomId]/page.tsx:409-450

- POL-009: 호스트/참가자 대기 화면 분리 표시
  - 조건 (코드 원문): `isHost() ? <초대 링크 UI> : <연결 중 UI>`
  - 조건 (비즈니스 번역): 대기 화면에서 호스트에게는 초대 링크 복사 UI를 표시하고, 일반 참가자에게는 "호스트와 연결 중" 안내를 표시한다.
  - 위반 시: 해당 없음
  - 코드 근거: app/room/[roomId]/page.tsx:412-448

---

### poker.카드_선택 관련 정책

- POL-010: 카드 덱 구성 고정 (Fibonacci + 특수값)
  - 조건 (코드 원문): `CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕']`
  - 조건 (비즈니스 번역): 투표에 사용할 수 있는 카드는 Fibonacci 수열(1, 2, 3, 5, 8, 13, 21)과 특수값('?', '☕') 총 9장으로 고정된다.
  - 위반 시: 해당 없음 (고정 상수)
  - 코드 근거: components/poker/CardDeck.tsx:7

- POL-011: 투표 공개 이후 카드 선택 불가
  - 조건 (코드 원문): `disabled={isRevealed}`, `onClick={isRevealed ? undefined : ...}`
  - 조건 (비즈니스 번역): 투표 결과가 공개되면(`phase === 'revealed'`) 모든 카드가 비활성화되어 추가 선택이 불가능하다.
  - 위반 시: 해당 없음 (UI 차단)
  - 코드 근거: components/poker/CardDeck.tsx:33-44, components/poker/PokerCard.tsx

---

### poker.투표_공개 관련 정책

- POL-012: 전원 투표 완료 + 2인 이상 시 자동 공개
  - 조건 (코드 원문): `phase === 'voting' && participants.length >= 2 && participants.every((p) => p.hasVoted)`
  - 조건 (비즈니스 번역): 투표 단계에서 참가자가 2명 이상이고 모든 참가자가 카드를 선택하면 자동 공개 프로세스가 시작된다.
  - 위반 시: 한 명이라도 미투표 시 공개 시작 안 됨
  - 코드 근거: app/room/[roomId]/page.tsx:111-112

- POL-013: 투표 공개 전 2초 카운트다운
  - 조건 (코드 원문): `setCountdown(2)`, `setInterval(..., 1000)`, `if (countdown === 0) { revealVotes() }`
  - 조건 (비즈니스 번역): 전원 투표 완료 감지 후 2초 카운트다운이 진행되고, 카운트다운이 0에 도달하면 모든 투표가 공개된다. 카운트다운 중 조건이 해제(참가자 이탈 등)되면 카운트다운이 취소된다.
  - 위반 시: 해당 없음
  - 코드 근거: app/room/[roomId]/page.tsx:251-270

- POL-014: 투표 없이 공개 시 '?' 처리
  - 조건 (코드 원문): `broadcastRef.current({ type: 'reveal', from: myId, vote: myVoteRef.current ?? '?' })`
  - 조건 (비즈니스 번역): 공개 시점에 투표값이 없는 경우 '?'로 대체하여 전송한다.
  - 위반 시: 해당 없음 (기본값 적용)
  - 코드 근거: app/room/[roomId]/page.tsx:268

---

### poker.결과_표시 관련 정책

- POL-015: Mode(최빈값) 계산 — 최초 최빈값 우선
  - 조건 (코드 원문): `freq[v] > maxCount` (엄격 부등호 — 동점 시 먼저 등장한 값 유지)
  - 조건 (비즈니스 번역): Mode는 가장 많이 선택된 투표값이다. 동점인 경우 투표 배열에서 먼저 등장한 값이 Mode로 선택된다.
  - 위반 시: 해당 없음
  - 코드 근거: store/usePokerStore.ts:255-264

- POL-016: Average(평균) 계산 — 숫자 투표만 포함
  - 조건 (코드 원문): `.filter((p) => p.vote !== undefined && !isNaN(Number(p.vote)))`
  - 조건 (비즈니스 번역): Average는 숫자로 변환 가능한 투표값(1, 2, 3, 5, 8, 13, 21)만 대상으로 계산된다. '?'나 '☕' 같은 비숫자 값은 평균 계산에서 제외된다.
  - 위반 시: 해당 없음
  - 코드 근거: store/usePokerStore.ts:268-274

- POL-017: 결과 화면 컨트롤은 호스트 전용
  - 조건 (코드 원문): `{isHost ? (<Re-vote / Next 버튼>) : (<p>호스트만 진행 가능</p>)}`
  - 조건 (비즈니스 번역): 투표 결과 공개 후 Re-vote(재투표)와 Next(다음 티켓) 버튼은 호스트에게만 표시된다. 일반 참가자에게는 "호스트만 진행 가능" 안내 문구가 표시된다.
  - 위반 시: 해당 없음 (UI 차단)
  - 코드 근거: components/poker/PokerTable.tsx:219-243

- POL-018: 마지막 티켓에서는 Next 버튼 비활성
  - 조건 (코드 원문): `{lastTicket ? <span>All Done</span> : <button onClick={onNext}>Next →</button>}`
  - 조건 (비즈니스 번역): 현재 티켓이 마지막 티켓이면 Next 버튼 대신 "All Done" 텍스트가 표시된다. 세션 완료는 TicketPanel의 All Done 상태에서 handleNext를 통해 전환된다.
  - 위반 시: 해당 없음
  - 코드 근거: components/poker/PokerTable.tsx:227-236

---

### poker.재투표 관련 정책

- POL-019: 재투표 시 모든 투표 상태 초기화
  - 조건 (코드 원문): `resetRound()` → `phase: 'voting', myVote: null, participants.map(p => ({ id, name, hasVoted: false }))`
  - 조건 (비즈니스 번역): 재투표가 실행되면 모든 참가자의 투표 값과 투표 완료 여부가 초기화되고, 단계가 투표 중으로 돌아간다. completedTickets에는 기록이 남지 않는다.
  - 위반 시: 해당 없음
  - 코드 근거: store/usePokerStore.ts:151-160

- POL-020: 재투표는 호스트만 실행 가능
  - 조건 (코드 원문): `phase === 'revealed' && isHost` 조건에서만 Re-vote 버튼 표시
  - 조건 (비즈니스 번역): 재투표는 투표 결과 공개 후 호스트만 실행할 수 있다. 재투표 명령은 모든 참가자에게 브로드캐스트된다.
  - 위반 시: 해당 없음 (UI 차단)
  - 코드 근거: components/poker/PokerTable.tsx:219-226, app/room/[roomId]/page.tsx:281-284

---

### poker.다음_티켓 관련 정책

- POL-021: 다음 티켓 이동 시 결과 스냅샷 기록
  - 조건 (코드 원문): `completedTickets: [...state.completedTickets, { ticket, votes, result: { mode: modeValue, average: avgValue } }]`
  - 조건 (비즈니스 번역): 다음 티켓으로 이동할 때 현재 티켓의 투표 결과(참가자별 투표값, Mode, Average)가 완료 목록에 스냅샷으로 기록된다. 기록 후에는 변경되지 않는다.
  - 위반 시: 해당 없음
  - 코드 근거: store/usePokerStore.ts:162-188

- POL-022: 다음 티켓 이동은 호스트만 실행 가능, 마지막 티켓 제외
  - 조건 (코드 원문): `phase === 'revealed' && isHost && !isLastTicket` 조건에서만 Next 버튼 표시
  - 조건 (비즈니스 번역): 다음 티켓으로 이동하는 권한은 호스트에게만 있으며, 투표 결과가 공개된 상태여야 한다. 마지막 티켓에서는 Next 버튼이 표시되지 않는다.
  - 위반 시: 해당 없음 (UI 차단)
  - 코드 근거: components/poker/PokerTable.tsx:227-235

- POL-023: mode()/average() 계산 시점은 participants 상태 초기화 이전
  - 조건 (코드 원문): `const modeValue = state.mode() ?? '?'`, `const avgValue = state.average() ?? 0` (set() 호출 전에 계산)
  - 조건 (비즈니스 번역): 다음 티켓 이동 시 결과 계산은 참가자 투표 상태가 초기화되기 전에 수행된다.
  - 위반 시: 해당 없음 (코드 실행 순서로 보장)
  - 코드 근거: store/usePokerStore.ts:172-173

---

### poker.세션_완료 관련 정책

- POL-024: 세션 완료 조건 — 마지막 티켓 통과 후
  - 조건 (코드 원문): `!ticket && tickets.length > 0` (`currentTicketIndex >= tickets.length`가 되어 `currentTicket()` null 반환)
  - 조건 (비즈니스 번역): 마지막 티켓에 대해 Next를 실행하면 더 이상 진행할 티켓이 없어 세션 완료 화면으로 전환된다.
  - 위반 시: 해당 없음
  - 코드 근거: app/room/[roomId]/page.tsx:453

- POL-025: 총 SP 계산 — 비숫자 Mode는 0으로 처리
  - 조건 (코드 원문): `const n = Number(ct.result.mode); return sum + (isNaN(n) ? 0 : n)`
  - 조건 (비즈니스 번역): 세션 완료 화면의 총 스토리 포인트 합계 계산 시, Mode가 '?'나 '☕'처럼 숫자가 아닌 경우 0으로 처리하여 합산한다.
  - 위반 시: 해당 없음 (기본값 적용)
  - 코드 근거: components/poker/SessionSummary.tsx:12-15

- POL-026: 세션 종료 시 로컬 상태 전체 초기화
  - 조건 (코드 원문): `leaveRoom()` → `set(initialState); sessionStorage.removeItem('poker-room')`
  - 조건 (비즈니스 번역): 세션 종료 버튼을 클릭하면 게임 상태 전체가 초기값으로 리셋되고 세션 스토리지에서 방 데이터가 삭제된 후 홈 화면으로 이동한다.
  - 위반 시: 해당 없음
  - 코드 근거: store/usePokerStore.ts:130-133, app/room/[roomId]/page.tsx:299-310

---

### poker.참가자_추방 관련 정책

- POL-027: 추방은 호스트만 가능, 자기 자신 제외
  - 조건 (코드 원문): `canKick={amHost && !isMe}`
  - 조건 (비즈니스 번역): 추방 버튼은 호스트에게만 표시되며, 호스트 자신의 좌석에는 표시되지 않는다.
  - 위반 시: 해당 없음 (UI 차단)
  - 코드 근거: components/poker/PokerTable.tsx:83

- POL-028: 추방 시 전체 브로드캐스트 후 즉시 제거
  - 조건 (코드 원문): `broadcastRef.current({ type: 'kick', targetId }); removeParticipant(targetId)`
  - 조건 (비즈니스 번역): 추방 명령은 모든 참가자에게 브로드캐스트되고, 호스트 측에서도 즉시 참가자 목록에서 제거된다. 추방 대상 참가자는 kick 메시지를 수신하면 "방에서 추방되었습니다" 화면으로 전환된다.
  - 위반 시: 해당 없음
  - 코드 근거: app/room/[roomId]/page.tsx:291-297, 155-162

---

### poker.방_종료_및_이탈 관련 정책

- POL-029: 호스트 방 종료 시 확인 다이얼로그 표시
  - 조건 (코드 원문): `if (!window.confirm('방을 종료하시겠습니까?\n모든 참가자의 연결이 끊어집니다.')) return`
  - 조건 (비즈니스 번역): 호스트가 방 종료 버튼을 누르면 확인 다이얼로그가 표시된다. 취소 시 방은 유지된다.
  - 위반 시: 취소 클릭 시 방 종료 없이 게임 계속 진행
  - 코드 근거: app/room/[roomId]/page.tsx:300-301

- POL-030: 탭 닫힘 시 서버에 이탈 알림 (sendBeacon)
  - 조건 (코드 원문): `beforeunload` → `navigator.sendBeacon(...)` + `broadcastRef.current({ type: 'leaving' })`
  - 조건 (비즈니스 번역): 탭을 닫거나 브라우저를 종료할 때도 서버에 이탈 신호를 전송한다. 호스트의 경우 confirm 다이얼로그가 먼저 표시된다.
  - 위반 시: 해당 없음 (best-effort 전송)
  - 코드 근거: app/room/[roomId]/page.tsx:91-109

- POL-031: 호스트 이탈 시 방 종료 브로드캐스트
  - 조건 (코드 원문): `broadcastRef.current({ type: 'room_closed' })`
  - 조건 (비즈니스 번역): 호스트가 방을 종료하면 모든 참가자에게 room_closed 메시지가 전송된다. 메시지를 수신한 참가자는 "방이 종료되었습니다" 화면으로 전환된다.
  - 위반 시: 해당 없음
  - 코드 근거: app/room/[roomId]/page.tsx:302

---

### poker.호스트_재접속 관련 정책

- POL-032: 호스트 이탈 시 참가자 대기 오버레이 표시
  - 조건 (코드 원문): `if (peerId === state.hostId) { setDepartedHostName(...); setHostWaiting(true) }`
  - 조건 (비즈니스 번역): 호스트가 연결을 끊으면 남아 있는 참가자에게 "호스트 재접속 대기 중" 오버레이가 표시된다. 대기 중에도 홈으로 나갈 수 있다.
  - 위반 시: 해당 없음
  - 코드 근거: app/room/[roomId]/page.tsx:223-234

- POL-033: 이름 완전 일치로 호스트 권한 복원
  - 조건 (코드 원문): `name === departedHostNameRef.current` → `migrateHost(peerId)`, 500ms 후 `host_migrated` 브로드캐스트
  - 조건 (비즈니스 번역): 이탈한 호스트와 동일한 이름으로 새 참가자가 연결되면 자동으로 호스트 권한이 복원된다. 이름은 대소문자를 포함한 완전 일치로 확인한다. 권한 복원 후 500ms 뒤에 모든 참가자에게 host_migrated 메시지가 전송된다.
  - 위반 시: 이름이 다르면 호스트 복원 안 됨, 대기 오버레이 유지
  - 코드 근거: app/room/[roomId]/page.tsx:208-221

---

### poker.p2p_연결_및_릴레이 관련 정책

- POL-034: WebRTC P2P 실패 시 8초 후 서버 릴레이 전환
  - 조건 (코드 원문): `const RELAY_FALLBACK_TIMEOUT = 8_000`, DataChannel이 하나도 열리지 않으면 activateRelayMode()
  - 조건 (비즈니스 번역): WebRTC DataChannel이 연결 시도 후 8초 이내에 열리지 않으면 자동으로 서버 릴레이 모드로 전환된다. 릴레이 모드에서는 게임 메시지가 서버를 통해 전달된다.
  - 위반 시: 해당 없음 (자동 전환)
  - 코드 근거: hooks/useWebRTC.ts:40, 133-151

- POL-035: 신규 참가자만 상태 동기화 요청 전송
  - 조건 (코드 원문): `if (entry.isInitiator) { sendRelay({ type: 'sync_request', ... }) }` / `channel.send(JSON.stringify({ type: 'sync_request' }))`
  - 조건 (비즈니스 번역): 방에 새로 입장한 참가자(Initiator)만 sync_request를 전송한다. 기존 참가자는 sync_request를 보내지 않아 불필요한 상태 동기화를 방지한다.
  - 위반 시: 해당 없음 (isInitiator 플래그로 제어)
  - 코드 근거: hooks/useWebRTC.ts:124-127, 169-171

- POL-036: 동기화 수신 시 자신의 투표 상태 유지
  - 조건 (코드 원문): `const myParticipant = state.participants.find((p) => p.id === myId)`, `mergedParticipants = syncState.participants.map((p) => p.id === myId && myParticipant ? myParticipant : p)`
  - 조건 (비즈니스 번역): 방 상태 동기화 메시지를 수신할 때 자신의 투표 상태(로컬에 저장된 상태)는 동기화 데이터에 의해 덮어씌워지지 않고 유지된다.
  - 위반 시: 해당 없음
  - 코드 근거: store/usePokerStore.ts:218-238

---

## 에러 시나리오

- ERR-001: "방을 찾을 수 없습니다 / 존재하지 않거나 이미 종료된 방입니다."
  - 발생 조건: 방 링크 접근 시 서버 메모리에 해당 방이 없거나 (방이 생성된 적 없음), 모든 참가자가 나가서 방이 삭제된 경우
  - 사용자 영향: 방 없음 전용 화면으로 대체, 포커 게임 UI 표시 불가
  - 대응 방법: "홈으로 돌아가기" 버튼으로 방 생성 화면으로 이동
  - 코드 근거: app/room/[roomId]/page.tsx:339-354

- ERR-002: "방이 종료되었습니다 / 호스트가 방을 나갔습니다."
  - 발생 조건: 호스트가 방을 종료하고 room_closed 메시지가 전송된 경우
  - 사용자 영향: 게임 화면 위에 오버레이로 방 종료 메시지 표시, 게임 진행 불가
  - 대응 방법: "홈으로 돌아가기" 버튼 클릭
  - 코드 근거: app/room/[roomId]/page.tsx:381-404

- ERR-003: "방에서 추방되었습니다 / 호스트에 의해 추방되었습니다."
  - 발생 조건: 호스트가 해당 참가자를 kick 처리한 경우
  - 사용자 영향: 게임 화면 위에 오버레이로 추방 메시지 표시, 게임 진행 불가
  - 대응 방법: "홈으로 돌아가기" 버튼 클릭
  - 코드 근거: app/room/[roomId]/page.tsx:381-404

---

## 상수/설정값

- 서버 릴레이 폴백 타임아웃: 8,000ms (8초)
  - 코드 근거: hooks/useWebRTC.ts:40

- 전원 투표 완료 후 공개 카운트다운: 2초
  - 코드 근거: app/room/[roomId]/page.tsx:251

- ICE candidate 배치 전송 윈도우: 100ms
  - 코드 근거: hooks/useWebRTC.ts:227

- 호스트 복원 후 브로드캐스트 딜레이: 500ms
  - 코드 근거: app/room/[roomId]/page.tsx:218-220

- 링크 복사 완료 피드백 노출 시간: 2,000ms
  - 코드 근거: app/room/[roomId]/page.tsx:319

- 참가자 이름 캐싱 localStorage 키: 'jira-joker-participant-name'
  - 코드 근거: components/poker/JoinRoomForm.tsx:12

- 게임 상태 sessionStorage 키: 'poker-room'
  - 코드 근거: store/usePokerStore.ts:288

- 카드 덱: 1, 2, 3, 5, 8, 13, 21, ?, ☕
  - 코드 근거: components/poker/CardDeck.tsx:7

---

## 용어

- 호스트: 방을 생성한 참가자. 투표 공개·재투표·다음 티켓·추방 등 게임 진행 권한을 독점적으로 보유한다.
- 참가자: 방에 입장한 사용자 전체. 호스트 포함.
- Phase(단계): 현재 투표 진행 상태. 'voting'(투표 중)과 'revealed'(공개됨) 두 가지.
- Mode(최빈값): 투표 결과에서 가장 많이 선택된 값.
- Average(평균): 숫자 투표값만 포함한 산술 평균.
- CompletedTicket(완료 티켓): 투표가 완료되고 다음 티켓으로 넘어간 티켓의 결과 스냅샷.
- SyncState(동기화 상태): 신규 참가자가 방에 입장할 때 기존 참가자로부터 받는 전체 게임 상태 페이로드.
- 릴레이 모드: WebRTC P2P 연결 실패 시 서버를 통해 게임 메시지를 중계하는 전송 방식.
- P2P 모드: WebRTC DataChannel을 통해 참가자 간 직접 게임 메시지를 전달하는 전송 방식.
- Fibonacci 수열: 이 시스템에서 사용하는 카드 덱의 숫자 기반. 1, 2, 3, 5, 8, 13, 21.
- 스토리 포인트(SP): Jira 이슈의 추정 작업량 단위.
