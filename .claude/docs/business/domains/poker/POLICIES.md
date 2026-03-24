# 포커 게임 도메인 - 서비스 정책서

> 최종 갱신: 2026-03-25

---

## poker.방_생성_위저드

### Validation 규칙

#### POL-001: Jira Cloud 인증 필드 완전성
- **규칙**: Cloud 인증 모드에서는 Jira 도메인, 계정 이메일, API Token 세 가지 모두 입력해야 다음 단계로 진행할 수 있다.
- **조건**: authMode가 'cloud'일 때 domain, email, token 중 하나라도 공백인 경우
- **위반 시**: "모든 필드를 입력해주세요." 에러 메시지를 표시하고 Step 2 진입을 차단한다.
- **비즈니스 배경**: Jira Cloud는 Basic Auth(이메일 + API Token) 방식을 요구하므로 세 필드가 모두 필요하다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (`handleStep1Next`, 87-90행)

#### POL-002: Jira Server·DC 인증 필드 완전성
- **규칙**: Server·DC 인증 모드에서는 Jira 기본 URL과 Personal Access Token(PAT) 두 가지만 입력하면 된다. 이메일은 불필요하다.
- **조건**: authMode가 'server'일 때 domain 또는 token이 공백인 경우
- **위반 시**: "모든 필드를 입력해주세요." 에러 메시지를 표시하고 Step 2 진입을 차단한다.
- **비즈니스 배경**: Jira Server·DC는 Bearer PAT 방식을 사용하므로 이메일 없이 토큰만으로 인증된다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (`handleStep1Next`, 88-90행)

#### POL-003: Jira 인증 실시간 검증
- **규칙**: Step 1에서 "다음" 버튼을 클릭하면 입력된 인증 정보로 Jira API에 실제 요청을 보내 유효성을 검증한다. 검증 성공 시에만 Step 2로 진행한다.
- **조건**: `/api/jira?type=myself` 응답이 실패(HTTP 오류)인 경우
- **위반 시**: 서버가 반환한 에러 메시지 또는 "연결 실패"를 표시하고 Step 2 진입을 차단한다.
- **비즈니스 배경**: 잘못된 인증 정보로 방이 생성되면 이후 이슈 조회가 모두 실패하므로, 위저드 초입에서 인증을 검증한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (`handleStep1Next`, 95-107행)

#### POL-004: 닉네임 필수 입력
- **규칙**: Planning Poker 세션에서 사용할 닉네임은 공백이 아닌 문자를 포함해야 한다.
- **조건**: name.trim()이 빈 문자열인 경우
- **위반 시**: "닉네임을 입력해주세요." 에러 메시지를 표시하고 Step 3 진입을 차단한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (`handleStep2Next`, 113-116행)

#### POL-005: Epic 검색 입력값 필수
- **규칙**: Epic 키 입력란이 비어있는 상태에서는 검색 버튼이 비활성화된다.
- **조건**: epicKeyInput.trim()이 빈 문자열인 경우
- **위반 시**: "검색" 버튼 disabled 처리 — 클릭 불가
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (362행, 검색 버튼 disabled 조건)

#### POL-006: Epic 타입 검증
- **규칙**: 입력한 Jira 이슈 키는 반드시 Epic 타입이어야 한다. Story, Task, Bug 등 다른 이슈 타입은 허용되지 않는다.
- **조건**: 이슈의 issuetype.hierarchyLevel이 1이 아니고, 이름이 'epic', '에픽', '큰틀' 중 하나도 아닌 경우
- **위반 시**: `"{epicKey}는 Epic 타입이 아닙니다 ({issuetype.name})"` 메시지를 에러 박스에 표시한다.
- **비즈니스 배경**: Planning Poker는 Epic 단위로 하위 이슈를 일괄 추정하는 워크플로우이므로 Epic이 아닌 이슈로 방을 생성하면 의미가 없다. 다국어(한글 '에픽', '큰틀')와 Cloud/Server 환경 모두 지원한다.
- **코드 근거**: `app/api/jira/route.ts` (79-87행)

#### POL-007: Epic 하위 이슈 존재 필수
- **규칙**: Epic 검색 결과 하위 이슈가 0건이면 방을 만들 수 없다.
- **조건**: foundEpic이 없거나 tickets.length가 0인 경우
- **위반 시**: "방 만들기" 버튼이 비활성화된다. 검색 결과 영역에 "하위 Task가 없습니다." 안내 문구 표시.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (`handleCreateRoom` 159행, 버튼 disabled 416행)

#### POL-008: 서버 측 Jira 인증 헤더 필수
- **규칙**: `/api/jira` 프록시 엔드포인트는 요청 헤더에 x-jira-domain과 x-jira-token이 반드시 있어야 처리한다.
- **조건**: domain 또는 token 헤더가 없는 경우
- **위반 시**: HTTP 400, `{ error: 'Missing Jira credentials' }` 응답 반환
- **코드 근거**: `app/api/jira/route.ts` (24-26행)

### 설정값

#### POL-009: Jira API 버전 자동 분기
- **설정**: Cloud → REST API v3 (`/rest/api/3`), Server·DC → REST API v2 (`/rest/api/2`)
- **비즈니스 의미**: Jira Cloud와 Server·DC는 API 버전이 다르므로 이메일 헤더 존재 여부로 자동 분기한다. 잘못된 버전 사용 시 이슈 조회 필드 매핑 오류가 발생할 수 있다.
- **변경 시 영향**: authHeader, apiBase URL 전체에 영향
- **코드 근거**: `app/api/jira/route.ts` (34-38행)

#### POL-010: 이슈 조회 최대 건수
- **설정**: maxResults = 100 (건)
- **비즈니스 의미**: Epic 하위 이슈를 최대 100건까지만 로드한다. 101건 이상의 Epic은 나머지 이슈가 누락된 채 세션이 시작된다.
- **변경 시 영향**: Cloud(POST body), Server(GET querystring) 양쪽 모두 변경 필요
- **코드 근거**: `app/api/jira/route.ts` (104행, 116행)

#### POL-011: Jira 인증 정보 로컬 캐싱
- **설정**: localStorage 키 `jira-joker-credentials` 에 authMode, domain, email, token, name 저장
- **비즈니스 의미**: 매번 인증 정보를 재입력하지 않아도 되도록 편의성을 제공한다. 저장 실패 시 조용히 무시한다(try-catch 보호).
- **변경 시 영향**: JoinRoomForm의 `jira-joker-participant-name` 키와 충돌 방지 필요
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (34행, 96-101행)

### 에러 시나리오

#### ERR-001: Jira 인증 필드 미입력
- **메시지**: "모든 필드를 입력해주세요."
- **발생 조건**: Step 1에서 인증 모드에 필요한 필드를 모두 채우지 않고 "다음"을 클릭한 경우
- **사용자 영향**: 에러 메시지가 Step 1 폼 하단에 빨간 텍스트로 표시되며 진행 불가
- **대응 방법**: 모든 필수 입력란을 채운 후 다시 시도한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (90행)

#### ERR-002: Jira 인증 실패
- **메시지**: "연결 실패" 또는 Jira 서버 반환 에러 메시지 (예: "인증 실패: 401 Unauthorized")
- **발생 조건**: Step 1에서 입력한 도메인, 이메일, 토큰 중 하나가 잘못되어 Jira API 인증에 실패한 경우
- **사용자 영향**: 에러 메시지가 Step 1 하단에 표시되며 Step 2 진입 불가
- **대응 방법**: Jira 도메인, 이메일 주소, API Token을 재확인한 후 다시 시도한다. Cloud와 Server·DC 인증 방식이 다르므로 모드 선택이 올바른지 확인한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (104행)

#### ERR-003: 닉네임 미입력
- **메시지**: "닉네임을 입력해주세요."
- **발생 조건**: Step 2에서 닉네임 입력 없이 "다음"을 클릭한 경우
- **사용자 영향**: 에러 메시지가 Step 2 하단에 표시되며 Step 3 진입 불가
- **대응 방법**: 닉네임을 입력한 후 다시 시도한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (114행)

#### ERR-004: Epic 검색 실패
- **메시지**: "Epic 검색 실패" 또는 Jira 서버 반환 에러 메시지
- **발생 조건**: Step 3에서 Epic 키 검색 API 호출이 실패한 경우 (네트워크 오류, 이슈 없음 등)
- **사용자 영향**: Step 3 내 붉은 테두리 에러 박스에 메시지 표시
- **대응 방법**: Epic 키 형식(예: PROJ-42)을 확인하고 재시도한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (143행)

#### ERR-005: Epic 이슈 없음
- **메시지**: "Epic을 찾을 수 없습니다: {epicKey}"
- **발생 조건**: 입력한 Epic Key에 해당하는 Jira 이슈가 존재하지 않는 경우 (HTTP 404)
- **사용자 영향**: ERR-004와 동일한 에러 박스에 표시
- **대응 방법**: Jira 프로젝트에서 Epic Key를 정확히 확인하고 재입력한다.
- **코드 근거**: `app/api/jira/route.ts` (67행)

#### ERR-006: Epic 타입 불일치
- **메시지**: "{epicKey}는 Epic 타입이 아닙니다 ({issuetype.name})"
- **발생 조건**: 입력한 키의 이슈는 존재하지만 Epic/에픽/큰틀 타입이 아닌 경우
- **사용자 영향**: ERR-004와 동일한 에러 박스에 표시
- **대응 방법**: Epic 타입의 이슈 키를 입력한다. Jira 프로젝트에서 이슈 타입을 확인한다.
- **코드 근거**: `app/api/jira/route.ts` (83-87행)

#### ERR-007: Jira 인증 오류 (서버 측)
- **메시지**: "인증 실패: {HTTP status} {body}"
- **발생 조건**: 프록시 서버가 Jira에 요청을 보냈을 때 Jira가 401/403 등 인증 오류를 반환한 경우
- **사용자 영향**: ERR-002와 동일 경로로 Step 1 에러 표시
- **대응 방법**: API Token이 만료되었거나 권한이 없는 경우이므로 Jira 계정 설정에서 토큰을 재발급받는다.
- **코드 근거**: `app/api/jira/route.ts` (52행)

#### ERR-011: Epic 하위 이슈 없음
- **메시지**: "하위 Task가 없습니다."
- **발생 조건**: Epic 검색은 성공했으나 해당 Epic 하위에 Story/Task/Bug 이슈가 0건인 경우
- **사용자 영향**: Epic 미리보기 영역에 안내 텍스트 표시, "방 만들기" 버튼 비활성화
- **대응 방법**: 해당 Epic에 하위 이슈를 추가하거나 다른 Epic을 선택한다.
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (384-385행)

---

## poker.투표

### Validation 규칙

#### POL-013: 투표 공개 트리거 조건
- **규칙**: 카운트다운이 시작되려면 현재 단계가 투표 중이고, 참가자가 2인 이상이며, 모든 참가자가 카드를 선택한 상태여야 한다.
- **조건**: phase='voting' AND participants.length >= 2 AND 전원 hasVoted=true
- **위반 시**: isAllVoted=false — 카운트다운 시작 안 됨, 카드 공개 대기
- **코드 근거**: `app/room/[roomId]/page.tsx` (111-112행)

#### POL-014: 투표 중 카드 값 비공개 원칙
- **규칙**: 참가자가 카드를 선택하면 "선택했다"는 사실(voted)만 다른 참가자에게 전달되고, 실제 카드 값은 전달되지 않는다. 공개(reveal)는 전원 투표 완료 후 별도 단계에서 이루어진다.
- **조건**: broadcast 메시지 타입이 'voted'이며 vote 값을 포함하지 않음
- **위반 시**: (설계 의도 — 남은 참가자가 다른 사람의 카드에 영향을 받지 않도록 보호)
- **비즈니스 배경**: Planning Poker의 핵심 원칙은 독립적 추정. 타인의 카드 값을 먼저 보면 앵커링 효과가 발생한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (`handleSelectCard`, 273-278행)

#### POL-015: 투표 재선택 허용
- **규칙**: 같은 라운드 내에서 카드를 여러 번 선택할 수 있으며, 마지막으로 선택한 카드 값이 최종 투표로 기록된다.
- **조건**: selectCard(value) 호출 시 기존 myVote 덮어씀
- **위반 시**: (없음 — 재선택 허용)
- **코드 근거**: `store/usePokerStore.ts` (`selectCard`, 135-141행)

#### POL-016: 공개 단계에서 카드 선택 비활성화
- **규칙**: 카드가 공개된(phase='revealed') 상태에서는 카드를 선택할 수 없다.
- **조건**: phase='revealed'이면 CardDeck의 모든 카드가 disabled 처리됨
- **위반 시**: 카드 클릭 이벤트가 차단되며 투표 상태 변경 없음
- **코드 근거**: `components/poker/CardDeck.tsx` (38-40행)

### 설정값

#### POL-017: 카드 덱 고정 값 목록
- **설정**: CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'] (9종)
- **비즈니스 의미**: Fibonacci 수열(1, 2, 3, 5, 8, 13, 21) 기반 7장으로 불확실성에 따른 크기 추정을 표현한다. '?'는 추정 불가 또는 정보 부족, '☕'는 휴식 요청을 의미하는 특수 카드다.
- **변경 시 영향**: isNaN(Number(vote)) 처리(average 계산), '?'를 fallback으로 사용하는 코드 모두 함께 검토 필요
- **코드 근거**: `components/poker/CardDeck.tsx` (7행, `CARD_VALUES`)

---

## poker.투표_공개

### 상태 정책

#### POL-018: voting → revealed 자동 전이
- **규칙**: 전원 투표 완료(isAllVoted=true) 시 2초 카운트다운 후 자동으로 카드 공개 단계로 전환된다.
- **전이**: `voting` → `revealed`
- **전이 조건**: isAllVoted가 true가 된 후 2초 경과 시 revealVotes() 자동 실행
- **역전이**: 불가 — revealed 상태가 되면 Re-vote(resetRound) 또는 Next(nextTicket) 액션을 통해서만 voting으로 돌아갈 수 있음
- **영향**: 각 참가자가 자신의 카드 값을 reveal DataMessage로 브로드캐스트 → 전체 카드 값 공개
- **코드 근거**: `app/room/[roomId]/page.tsx` (Effect 1: 246-262행, Effect 2: 264-271행)

### 설정값

#### POL-019: 투표 공개 카운트다운 시간
- **설정**: 카운트다운 = 2 (초)
- **비즈니스 의미**: 마지막 참가자 투표 직후 즉시 공개되면 나머지가 놀라거나 준비할 시간이 없다. 2초의 대기 시간은 심리적 준비를 위한 완충 역할을 한다.
- **변경 시 영향**: `setCountdown(2)` 초기화 값 및 setInterval 로직 함께 변경 필요
- **코드 근거**: `app/room/[roomId]/page.tsx` (251행)

### Validation 규칙

#### POL-020: Mode 계산 — 미투표 참가자 제외
- **규칙**: Mode(최빈값) 계산 시 카드를 공개하지 않은(vote=undefined) 참가자는 집계에서 제외한다.
- **조건**: participants.filter(p => p.vote !== undefined)
- **위반 시**: (없음 — 제외하여 집계)
- **코드 근거**: `store/usePokerStore.ts` (`mode()`, 251-254행)

#### POL-021: Average 계산 — 특수 카드 제외
- **규칙**: Average(평균) 계산 시 숫자로 변환할 수 없는 카드값('?', '☕')은 평균 계산에서 제외한다.
- **조건**: !isNaN(Number(p.vote))인 항목만 포함
- **위반 시**: '?', '☕'는 평균 분자/분모 모두에서 제외
- **비즈니스 배경**: '?'(추정 불가)와 '☕'(휴식 요청)는 숫자 추정이 아닌 의사 표시이므로 수치 계산에서 제외한다.
- **코드 근거**: `store/usePokerStore.ts` (`average()`, 269-273행)

#### POL-022: Re-vote/Next 버튼 접근 제한
- **규칙**: "다시 투표" 버튼과 "다음 티켓" 버튼은 호스트만 사용할 수 있으며, 카드 공개(phase='revealed') 상태에서만 활성화된다.
- **조건**: isHost()=true AND phase='revealed'
- **위반 시**: 참가자는 해당 버튼이 표시되지 않음
- **코드 근거**: `app/room/[roomId]/page.tsx` (`handleReset` 281-283행, `handleNext` 286-289행)

### 에러 시나리오

#### ERR-019: reveal 시 미투표 처리
- **메시지**: (에러 없음 — 카드 값 '?'로 자동 대체)
- **발생 조건**: 카운트다운이 0이 되는 시점에 자신의 myVote가 null인 경우
- **사용자 영향**: '?' 값으로 자동 reveal 처리되어 집계에는 포함되나 average에서는 제외됨
- **대응 방법**: (자동 처리 — 사용자 조치 불필요)
- **코드 근거**: `app/room/[roomId]/page.tsx` (268행, `myVoteRef.current ?? '?'`)

---

## poker.재투표

### 상태 정책

#### POL-023: revealed → voting 전이 (재투표)
- **규칙**: 호스트가 "다시 투표" 버튼을 클릭하면 현재 라운드의 모든 투표 기록을 초기화하고 다시 투표 단계로 돌아간다.
- **전이**: `revealed` → `voting`
- **전이 조건**: isHost()=true AND phase='revealed' 상태에서 Re-vote 버튼 클릭
- **역전이**: 가능 — voting 단계에서 전원 투표 완료 시 다시 revealed로 전환 가능
- **영향**: 모든 참가자의 hasVoted=false, vote=undefined, myVote=null 초기화. 같은 티켓을 다시 추정
- **코드 근거**: `app/room/[roomId]/page.tsx` (`handleReset`, 281-283행); `store/usePokerStore.ts` (`resetRound`, 151-160행)

---

## poker.다음_티켓

### 상태 정책

#### POL-024: revealed → voting 전이 (다음 티켓)
- **규칙**: 호스트가 "다음 티켓" 버튼을 클릭하면 현재 결과를 기록하고 다음 티켓에 대한 투표 단계로 진입한다.
- **전이**: `revealed` → `voting` (다음 티켓 인덱스로)
- **전이 조건**: isHost()=true AND phase='revealed' AND 마지막 티켓이 아닌 경우
- **역전이**: 불가 — 이미 완료된 티켓(CompletedTicket)은 기록에서 제거되지 않음
- **영향**: currentTicketIndex+1, completedTickets에 현재 결과 추가, 전 참가자 투표 상태 초기화
- **코드 근거**: `store/usePokerStore.ts` (`nextTicket`, 162-189행)

#### POL-025: 완료 티켓 결과 기록
- **규칙**: 다음 티켓으로 넘어갈 때 현재 티켓의 Mode와 Average 결과가 CompletedTicket으로 영구 기록된다. 모든 참가자의 개별 투표값(이름→값 맵)도 함께 저장된다.
- **전이**: 현재 티켓 → CompletedTicket (불변 레코드)
- **전이 조건**: nextTicket() 호출 시
- **역전이**: 불가 — CompletedTicket은 생성 후 불변
- **영향**: TicketHistory 패널에 완료 이력 추가; 세션 종료 시 SessionSummary에 표시
- **코드 근거**: `store/usePokerStore.ts` (`nextTicket`, 172-179행)

### Validation 규칙

#### POL-026: 마지막 티켓 판별
- **규칙**: 현재 티켓 인덱스가 전체 티켓 수에서 1을 뺀 값 이상이면 마지막 티켓으로 판별한다.
- **조건**: currentTicketIndex >= tickets.length - 1
- **위반 시**: (없음 — 파생 함수 반환값으로 UI 제어)
- **코드 근거**: `store/usePokerStore.ts` (`isLastTicket`, 281-284행)

---

## poker.세션_완료

### Validation 규칙

#### POL-027: 세션 완료 화면 진입 조건
- **규칙**: 모든 티켓을 소진하여 currentTicket()이 null이 되고, 티켓 목록이 비어있지 않을 때 세션 완료 화면을 표시한다.
- **조건**: !ticket AND tickets.length > 0
- **위반 시**: (조건 불충족 시 게임 화면 유지 또는 대기 화면 표시)
- **코드 근거**: `app/room/[roomId]/page.tsx` (453행)

#### POL-028: 총 SP 합산 규칙
- **규칙**: 세션 완료 화면에 표시되는 총 SP는 각 티켓의 Mode 값이 숫자인 경우만 합산한다. '?', '☕'로 결정된 티켓은 합산에서 제외한다.
- **조건**: isNaN(Number(ct.result.mode)) 이면 0으로 처리
- **위반 시**: 비숫자 mode 티켓은 SP 0으로 합산
- **비즈니스 배경**: '?'(추정 불가)와 '☕'(휴식 요청)는 구체적 포인트가 없으므로 SP 합산에서 의미 있게 제외한다.
- **코드 근거**: `components/poker/SessionSummary.tsx` (12-15행)

---

## poker.상태_동기화

### Validation 규칙

#### POL-029: sync_request 발신 주체 제한
- **규칙**: sync_request(전체 상태 요청)는 신규 합류 피어(initiator)만 발신한다. 기존 피어가 sync_request를 받아 빈 상태를 sync_response로 보내는 상황을 방지한다.
- **조건**: entry.isInitiator=true인 경우만 sync_request 전송
- **위반 시**: (방지하지 않으면 기존 피어가 불필요한 sync_request를 발신할 수 있음)
- **비즈니스 배경**: 릴레이 모드 활성화 시 기존 피어도 peer_joined 이벤트를 받으므로 발신 주체를 명확히 제한해야 한다.
- **코드 근거**: `hooks/useWebRTC.ts` (124-127행)

#### POL-030: 동기화 시 자신의 투표 보존
- **규칙**: sync_response로 게임 상태를 동기화할 때, 자신이 이미 선택한 카드 값은 덮어쓰지 않는다.
- **조건**: applySyncState에서 myParticipant 항목은 syncState 값이 아닌 로컬 값 유지
- **위반 시**: 이미 투표한 참가자가 동기화 수신 시 자신의 투표가 사라질 수 있음
- **코드 근거**: `store/usePokerStore.ts` (`applySyncState`, 218-237행)

#### POL-031: 중복 참가자 추가 차단
- **규칙**: 동일한 ID의 참가자가 이미 목록에 있으면 중복 추가를 무시한다.
- **조건**: participants.some(x => x.id === p.id)이면 addParticipant 무시
- **위반 시**: (없음 — 중복 방지)
- **코드 근거**: `store/usePokerStore.ts` (`addParticipant`, 194-196행)

#### POL-032: 중복 이탈 이벤트 무시
- **규칙**: 이미 participants에서 제거된 피어의 이탈 이벤트(leaving DataMessage 또는 onPeerDisconnected 콜백)가 중복 도착해도 무시한다.
- **조건**: !state.participants.some(p => p.id === peerId)이면 처리 건너뜀
- **위반 시**: (없음 — 중복 방지)
- **비즈니스 배경**: peer_left SSE 이벤트와 onconnectionstatechange 콜백이 중복 발생할 수 있는 환경을 방어한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (169행, 226행)

---

## poker.방_관리 (room 도메인 연관)

### Validation 규칙

#### POL-038: 최소 참가자 수 — 게임 시작 조건
- **규칙**: 참가자가 2인 미만이면 게임 화면 대신 대기 화면을 표시한다. 1명만으로는 Planning Poker를 진행할 수 없다.
- **조건**: participants.length < 2
- **위반 시**: 호스트에게는 초대 링크 공유 UI, 참가자에게는 "호스트와 연결 중..." 화면 표시
- **코드 근거**: `app/room/[roomId]/page.tsx` (409행)

#### POL-039: 방 존재 여부 사전 검증
- **규칙**: 초대 링크를 통해 접속한 사용자는 닉네임 입력 전에 서버에서 방의 존재 여부를 확인한다. 방이 없으면 게임 참여 화면 대신 오류 화면을 표시한다.
- **조건**: myName이 없거나 storeRoomId !== roomId인 경우 GET /api/room/{roomId} 호출
- **위반 시**: roomValid=false 시 "방을 찾을 수 없습니다" 화면 표시
- **코드 근거**: `app/room/[roomId]/page.tsx` (77-88행)

#### POL-040: 호스트 방 종료 재확인
- **규칙**: 호스트가 "방 종료" 버튼을 클릭하면 실수 방지를 위해 확인 다이얼로그를 표시한다. 취소 시 종료를 중단한다.
- **조건**: window.confirm('방을 종료하시겠습니까?\n모든 참가자의 연결이 끊어집니다.') = false
- **위반 시**: 종료 처리 중단 — room_closed 브로드캐스트 및 leaveRoom 실행 안 됨
- **코드 근거**: `app/room/[roomId]/page.tsx` (`handleLeaveRoom`, 301행)

#### POL-041: 호스트 탭 이탈 방지
- **규칙**: 호스트가 브라우저 탭을 닫거나 새로고침하려 할 때 브라우저의 이탈 확인 다이얼로그가 표시된다. 참가자에게는 표시되지 않는다.
- **조건**: beforeunload 이벤트 시 isHost()=true이면 e.preventDefault() 호출
- **위반 시**: (없음 — 호스트만 확인 다이얼로그 표시)
- **비즈니스 배경**: 호스트가 실수로 탭을 닫으면 모든 참가자의 세션이 중단되므로 이중 방지 장치를 둔다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (93-95행)

#### POL-042: Jira 인증 정보 P2P 전송 제외
- **규칙**: JiraConfig(도메인, 토큰, 이메일)는 P2P DataChannel로 다른 참가자에게 전달되지 않는다.
- **조건**: SyncState 인터페이스에 jiraConfig 필드 미포함
- **위반 시**: (없음 — 설계 의도)
- **비즈니스 배경**: Jira API Token은 민감 정보이므로 신규 참가자가 호스트의 토큰을 알 수 없어야 한다. 게임 진행에 필요한 데이터(티켓 목록, 투표 상태)만 동기화한다.
- **코드 근거**: `store/usePokerStore.ts` (35-42행, SyncState 인터페이스)

#### POL-043: 게임 상태 세션스토리지 자동 저장
- **규칙**: 게임 상태(roomId, 참가자, 투표 단계, 티켓 목록 등)는 sessionStorage에 자동으로 저장된다. 브라우저 새로고침 후에도 상태가 복원된다.
- **조건**: Zustand persist 미들웨어, sessionStorage 키 'poker-room'
- **위반 시**: (없음 — 정상 동작)
- **비즈니스 배경**: Planning Poker 중 실수로 새로고침하더라도 세션이 유지되어야 한다.
- **코드 근거**: `store/usePokerStore.ts` (286-302행)

### 에러 시나리오

#### ERR-008: 방을 찾을 수 없음
- **메시지**: "방을 찾을 수 없습니다" / "존재하지 않거나 이미 종료된 방입니다."
- **발생 조건**: 초대 링크로 접속했으나 서버에 해당 방이 존재하지 않는 경우 (방 종료, 서버 재시작 등)
- **사용자 영향**: 별도 오류 화면 표시 + "홈으로 돌아가기" 링크
- **대응 방법**: 호스트에게 새 방 생성 및 초대 링크 재전송을 요청한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (343-344행)

#### ERR-009: 방 종료 알림
- **메시지**: "방이 종료되었습니다" / "호스트가 방을 나갔습니다."
- **발생 조건**: 세션 중 호스트가 room_closed DataMessage를 브로드캐스트한 경우
- **사용자 영향**: 반투명 오버레이 전체 화면 표시 + "홈으로 돌아가기" 버튼. 이미 진행한 투표 결과는 화면에 유지됨.
- **대응 방법**: "홈으로 돌아가기"를 클릭하여 홈 화면으로 이동한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (382-403행)

#### ERR-010: 추방 알림
- **메시지**: "방에서 추방되었습니다" / "호스트에 의해 추방되었습니다."
- **발생 조건**: 호스트가 자신을 대상으로 kick DataMessage를 전송한 경우
- **사용자 영향**: 반투명 오버레이 전체 화면 표시 + "홈으로 돌아가기" 버튼
- **대응 방법**: 호스트에게 재초대를 요청한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (382-403행)

---

## poker.WebRTC_연결 (realtime 도메인 연관)

### 상태 정책

#### POL-033: WebRTC P2P 연결 실패 시 릴레이 자동 전환
- **규칙**: 첫 번째 피어가 발견된 후 8초 이내에 P2P DataChannel이 열리지 않으면 서버 릴레이 모드로 자동 전환된다.
- **전이**: `connecting` → `relay` (TransportMode)
- **전이 조건**: 첫 피어 발견 후 8000ms 경과 AND DataChannel readyState='open' 없음 AND 피어 목록이 비어있지 않음
- **역전이**: 불가 — 릴레이 모드는 세션 내 불가역
- **영향**: 이후 모든 메시지가 서버를 경유하여 전달됨 (투명하게 동작, 호출측 코드 변경 없음)
- **코드 근거**: `hooks/useWebRTC.ts` (`RELAY_FALLBACK_TIMEOUT`=8000, 40행; `scheduleRelayFallback`, 133-151행)

#### POL-034: P2P 연결 성공 시 릴레이 전환 취소
- **규칙**: DataChannel이 성공적으로 열리면 진행 중인 릴레이 폴백 타이머를 취소하고 P2P 모드를 확정한다.
- **전이**: `connecting` → `p2p` (TransportMode)
- **전이 조건**: RTCDataChannel.onopen 이벤트 발생
- **역전이**: 불가 — p2p 확정 후 relay로의 전환 로직 없음
- **코드 근거**: `hooks/useWebRTC.ts` (`setupDataChannel`, 157-163행)

### 설정값

#### POL-035: ICE Candidate 배치 전송 윈도우
- **설정**: candidateTimer 지연 = 100 (ms)
- **비즈니스 의미**: ICE candidate를 100ms 단위로 묶어 배치 전송하여 시그널링 서버 왕복 횟수를 줄이고 WebRTC 연결 수립 시간을 단축한다.
- **변경 시 영향**: 연결 수립 지연 vs. 서버 부하 트레이드오프 조정
- **코드 근거**: `hooks/useWebRTC.ts` (227행)

#### POL-036: ICE Candidate 버퍼링
- **설정**: remoteDescription 설정 완료 전 수신된 ICE candidate는 pendingCandidates 큐에 보관
- **비즈니스 의미**: ICE candidate가 setRemoteDescription보다 먼저 도착하는 race condition을 방지한다. remoteDescription 완료 후 큐에 쌓인 candidate를 일괄 적용한다.
- **코드 근거**: `hooks/useWebRTC.ts` (421-425행)

#### POL-037: STUN 서버 다중화
- **설정**: Google STUN 서버 3개 동시 사용 (stun.l.google.com, stun1, stun2, 포트 19302)
- **비즈니스 의미**: 단일 STUN 서버 장애 시 대체 경로로 NAT 통과를 시도할 수 있다.
- **코드 근거**: `hooks/useWebRTC.ts` (`RTC_CONFIG`, 31-37행)
