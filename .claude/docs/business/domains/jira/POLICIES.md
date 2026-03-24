# Jira 연동 도메인 - 서비스 정책서

> 최종 갱신: 2026-03-25

---

## jira.인증_검증

### Validation 규칙

#### POL-001: Cloud 모드 필수 필드 입력 검증
- **규칙**: Cloud 모드로 연결 시도할 때 도메인, 이메일, 토큰 세 가지 모두 입력되어 있어야 한다.
- **조건**: 인증 모드가 Cloud이고, 도메인·이메일·토큰 중 하나라도 빈 값인 경우
- **위반 시**: "모든 필드를 입력해주세요." 오류 메시지 표시, Jira 연결 시도 차단
- **비즈니스 배경**: Cloud 인증(Basic auth)은 email:token 쌍이 모두 필요하므로 어느 하나라도 없으면 인증 자체가 불가능
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleStep1Next, L87-91)

#### POL-002: Server/DC 모드 필수 필드 입력 검증
- **규칙**: Server·Data Center 모드로 연결 시도할 때 도메인과 토큰이 모두 입력되어 있어야 한다.
- **조건**: 인증 모드가 Server이고, 도메인 또는 토큰이 빈 값인 경우
- **위반 시**: "모든 필드를 입력해주세요." 오류 메시지 표시, Jira 연결 시도 차단
- **비즈니스 배경**: Server/DC 인증(Bearer PAT)은 이메일이 불필요하나 도메인과 PAT은 필수
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleStep1Next, L88-91)

#### POL-003: 서버 측 인증 헤더 필수 검증
- **규칙**: `/api/jira` 프록시로 요청이 들어올 때 Jira 도메인과 토큰 헤더가 모두 존재해야 한다.
- **조건**: `x-jira-domain` 또는 `x-jira-token` 요청 헤더 중 하나라도 없는 경우
- **위반 시**: HTTP 400 응답, 에러 메시지 "Missing Jira credentials"
- **비즈니스 배경**: 서버 프록시가 클라이언트로부터 인증 정보를 헤더로 전달받는 구조이므로 헤더 부재는 비정상 호출에 해당
- **코드 근거**: `app/api/jira/route.ts` (GET handler, L24-26)

#### POL-004: Cloud/Server 인증 방식 자동 분기
- **규칙**: 이메일 헤더(`x-jira-email`) 존재 여부에 따라 인증 방식과 API 버전이 자동으로 결정된다.
- **조건**: 이메일 헤더가 있으면 Cloud, 없으면 Server/DC로 판별
- **위반 시**: 없음 (자동 처리)
- **비즈니스 배경**: Jira Cloud는 Basic auth(email + API Token)와 REST API v3, Server/DC는 Bearer PAT과 REST API v2를 사용하는 구조적 차이가 있어 분기 처리 필수
- **코드 근거**: `app/api/jira/route.ts` (GET handler, L34-38)

#### POL-005: 도메인 URL 자동 정규화
- **규칙**: 사용자가 입력한 도메인 값에 "http"가 없으면 자동으로 `https://`를 붙이고, 끝의 `/`를 제거한다.
- **조건**: domain이 "http"로 시작하지 않는 경우
- **위반 시**: 없음 (자동 처리)
- **비즈니스 배경**: 사용자 편의상 "company.atlassian.net" 형태로 입력해도 정상 동작하도록 설계
- **코드 근거**: `app/api/jira/route.ts` (GET handler, L32)

---

## jira.에픽_조회

### Validation 규칙

#### POL-006: Epic 키 필수 검증 (서버)
- **규칙**: Epic 조회 요청에는 반드시 `epicKey` 파라미터가 포함되어야 한다.
- **조건**: `type=epic` 요청에 epicKey 쿼리 파라미터가 없는 경우
- **위반 시**: HTTP 400, "epicKey is required"
- **비즈니스 배경**: 서버는 어떤 Epic을 조회할지 알 수 없으므로 epicKey 없이는 처리 불가
- **코드 근거**: `app/api/jira/route.ts` (type=epic 분기, L61-63)

#### POL-007: Epic 타입 유효성 검증
- **규칙**: 입력한 이슈 키가 실제 Epic 타입의 이슈여야 한다. Story, Task 등 Epic이 아닌 이슈 키는 허용되지 않는다.
- **조건**: 이슈의 `hierarchyLevel`이 1이 아니고, issuetype 이름이 'epic', '에픽', '큰틀' 모두 해당하지 않는 경우
- **위반 시**: HTTP 400, "{epicKey}는 Epic 타입이 아닙니다 ({실제 이슈 타입명})"
- **비즈니스 배경**: Planning Poker 세션은 Epic 단위로 하위 이슈를 일괄 처리하는 구조이므로 Epic이 아닌 이슈를 출발점으로 삼으면 이슈 목록을 정상 조회할 수 없음. 다국어·다환경 지원을 위해 `hierarchyLevel`, 영문명, 한국어명 세 가지 조건 모두를 OR로 허용
- **코드 근거**: `app/api/jira/route.ts` (type=epic 분기, L77-87)

#### POL-008: Epic 검색 입력값 비어있으면 요청 차단 (클라이언트)
- **규칙**: Epic 키 입력 필드가 비어 있는 상태에서는 검색 요청이 발송되지 않는다.
- **조건**: epicKeyInput이 공백만으로 이루어진 경우
- **위반 시**: 검색 버튼 클릭이 무시됨 (검색 버튼 자체가 비활성화 상태)
- **비즈니스 배경**: 불필요한 빈 요청을 방지하여 API 부하 및 혼란 방지
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleSearchEpic, L129-130) / 버튼 disabled 조건 L362

#### POL-009: Epic 키 변경 시 이전 검색 결과 초기화
- **규칙**: Epic 키 입력 필드 내용이 변경되면 이전 검색 결과(Epic 정보, 이슈 목록, 오류 메시지)가 즉시 초기화된다.
- **조건**: epicKeyInput 값이 변경되는 모든 경우
- **위반 시**: 없음 (자동 처리)
- **비즈니스 배경**: 이전 Epic의 이슈 목록이 화면에 남아 있으면 새 Epic 검색 전 잘못된 데이터로 방 생성 버튼이 활성화될 수 있어 방지
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleEpicKeyChange, L150-155)

---

## jira.이슈_목록_조회

### Validation 규칙

#### POL-010: Epic 키 필수 검증 (서버, 이슈 조회)
- **규칙**: 이슈 목록 조회 요청에는 반드시 `epicKey` 파라미터가 포함되어야 한다.
- **조건**: `type=issues` 요청에 epicKey 쿼리 파라미터가 없는 경우
- **위반 시**: HTTP 400, "epicKey is required"
- **코드 근거**: `app/api/jira/route.ts` (type=issues 분기, L95-97)

#### POL-011: Cloud/Server JQL 쿼리 자동 분기
- **규칙**: Jira 환경(Cloud vs Server/DC)에 따라 이슈 검색 방식이 다르게 적용된다.
- **조건**: 이메일 헤더 존재 여부로 분기
  - Cloud: POST `/rest/api/3/search/jql`, JQL `parent = {epicKey}` 사용 (직접 부모-자식 관계)
  - Server/DC: GET `/rest/api/2/search`, JQL `"Epic Link" = {epicKey} AND issuetype in (Story, Task, Bug)` 사용
- **위반 시**: 없음 (자동 처리)
- **비즈니스 배경**: Jira Cloud와 Server/DC는 Epic-하위 이슈 관계를 다른 방식으로 표현. Cloud는 `parent` 필드, Server/DC는 `Epic Link` 커스텀 필드를 사용하므로 분기 필수
- **코드 근거**: `app/api/jira/route.ts` (type=issues 분기, L99-125)

#### POL-012: 방 생성 버튼 활성화 조건
- **규칙**: Epic 조회와 이슈 목록 조회가 모두 성공하고, 이슈가 1건 이상 존재할 때만 "방 만들기" 버튼이 활성화된다.
- **조건**: foundEpic이 null이 아니고, tickets 배열 길이가 1 이상인 경우
- **위반 시**: "방 만들기" 버튼 비활성화(disabled) 상태 유지
- **비즈니스 배경**: 이슈가 없는 Epic으로 포커 세션을 시작하면 추정할 티켓이 없어 의미 없는 세션이 됨
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleCreateRoom L159, 버튼 disabled L416)

### 설정값

#### POL-013: 이슈 조회 최대 건수 제한
- **설정**: maxResults = 100 (건)
- **비즈니스 의미**: 한 Epic에서 조회되는 최대 이슈 수. 100건을 초과하는 대형 Epic에서는 생성일 DESC 기준으로 최신 100건만 반환되며, 오래된 이슈는 누락됨
- **변경 시 영향**: 값을 올리면 대형 Epic 지원 범위가 넓어지지만 API 응답 시간과 메모리 사용량이 증가. 낮추면 빠르지만 누락 범위 확대
- **코드 근거**: `app/api/jira/route.ts` (type=issues 분기, L104, L123)

### 에러 시나리오

#### ERR-001: 인증 헤더 누락
- **메시지**: "Missing Jira credentials"
- **발생 조건**: API 프록시 요청 시 도메인 또는 토큰 헤더가 없는 경우 (정상 UI 흐름에서는 발생하지 않음)
- **사용자 영향**: HTTP 400 반환. 직접 API를 호출하는 비정상 경로에서만 노출
- **대응 방법**: Jira 도메인과 토큰을 포함하여 재요청
- **코드 근거**: `app/api/jira/route.ts` (GET handler, L25)

#### ERR-002: Jira 인증 실패
- **메시지**: "인증 실패: {HTTP 상태코드} {응답 본문}"
- **발생 조건**: 입력한 Jira 도메인·이메일·토큰 정보로 Jira `/myself` 엔드포인트 호출이 실패할 때 (잘못된 토큰, 만료된 토큰, 접근 권한 없음 등)
- **사용자 영향**: Step 1(Jira 연결) 화면 하단에 빨간 오류 메시지 표시. 다음 단계(닉네임 설정)로 진행 불가
- **대응 방법**: Jira 도메인 주소, 이메일(Cloud), API 토큰을 확인하고 재입력. Jira 관리자에게 토큰 권한 확인 요청
- **코드 근거**: `app/api/jira/route.ts` (type=myself 분기, L51-53)

#### ERR-003: Epic을 찾을 수 없음
- **메시지**: "Epic을 찾을 수 없습니다: {epicKey}"
- **발생 조건**: 입력한 Epic 키에 해당하는 Jira 이슈가 존재하지 않을 때 (Jira가 404 반환)
- **사용자 영향**: Step 3(Epic 선택) 화면의 Epic 검색 필드 하단에 오류 메시지 표시
- **대응 방법**: Epic 키(예: PROJ-42)가 정확한지, 해당 Jira 인스턴스에 실제로 존재하는지 확인
- **코드 근거**: `app/api/jira/route.ts` (type=epic 분기, L67)

#### ERR-004: Epic 타입 불일치
- **메시지**: "{epicKey}는 Epic 타입이 아닙니다 ({실제 이슈 타입명})"
- **발생 조건**: 입력한 키가 존재하지만 Epic이 아닌 이슈(Story, Task, Bug 등)일 때
- **사용자 영향**: Step 3 Epic 검색 필드 하단에 오류 메시지 표시. 이슈 목록 조회 및 방 생성 불가
- **대응 방법**: Epic 타입의 이슈 키를 입력해야 함. Jira에서 해당 키의 이슈 타입을 확인
- **코드 근거**: `app/api/jira/route.ts` (type=epic 분기, L82-87)

#### ERR-005: Jira API 일반 오류
- **메시지**: "Jira error: {HTTP 상태코드} {응답 본문}"
- **발생 조건**: Epic 조회 또는 이슈 목록 조회 시 Jira API가 4xx/5xx 오류를 반환할 때 (404 제외)
- **사용자 영향**: Step 3 화면의 Epic 검색 필드 하단에 오류 메시지 표시
- **대응 방법**: Jira 서버 상태 확인, 해당 Project/Epic에 대한 접근 권한 확인
- **코드 근거**: `app/api/jira/route.ts` (L71-73, L129-131)

#### ERR-006: 필드 미입력
- **메시지**: "모든 필드를 입력해주세요."
- **발생 조건**: Step 1에서 인증 모드에 따른 필수 입력 필드(도메인, 이메일(Cloud만), 토큰)가 하나라도 비어 있을 때
- **사용자 영향**: Step 1 화면 하단에 오류 메시지 표시, Jira 연결 시도 차단
- **대응 방법**: 모든 필수 필드를 입력 후 재시도
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleStep1Next, L90)

#### ERR-007: 닉네임 미입력
- **메시지**: "닉네임을 입력해주세요."
- **발생 조건**: Step 2에서 닉네임을 입력하지 않고 "다음" 버튼을 누를 때
- **사용자 영향**: Step 2 화면 하단에 오류 메시지 표시, Step 3 진입 차단
- **대응 방법**: 닉네임 입력 후 재시도
- **코드 근거**: `components/poker/CreateRoomWizard.tsx` (handleStep2Next, L114)

#### ERR-008: 알 수 없는 type 파라미터
- **메시지**: "Invalid type parameter"
- **발생 조건**: `/api/jira` 요청의 `type` 파라미터가 'myself', 'epic', 'issues' 외의 값일 때
- **사용자 영향**: HTTP 400 반환. 정상 UI 흐름에서는 발생하지 않음
- **대응 방법**: 올바른 type 파라미터로 재요청
- **코드 근거**: `app/api/jira/route.ts` (GET handler, L177)

---
