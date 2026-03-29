# jira-integration 비즈니스 규칙 추출 결과

## 정책

### poker.jira_auth_validate 관련 정책

#### POL-001: 인증 필드 필수 입력 (Cloud)
- 조건 (코드 원문): `authMode === 'cloud' && (!domain.trim() || !email.trim() || !token.trim())`
- 조건 (비즈니스 번역): Cloud 모드에서는 도메인, 이메일, API Token 세 가지 모두 입력해야 다음 단계로 진행할 수 있다.
- 위반 시: 오류 메시지 "모든 필드를 입력해주세요." 표시, Step 1에서 이동 불가
- 코드 근거: components/poker/CreateRoomWizard.tsx:87-90

#### POL-002: 인증 필드 필수 입력 (Server·DC)
- 조건 (코드 원문): `authMode === 'server' && (!domain.trim() || !token.trim())`
- 조건 (비즈니스 번역): Server·DC 모드에서는 도메인(Base URL)과 Personal Access Token 두 가지만 필수이며 이메일은 요구하지 않는다.
- 위반 시: 오류 메시지 "모든 필드를 입력해주세요." 표시, Step 1에서 이동 불가
- 코드 근거: components/poker/CreateRoomWizard.tsx:88-90

#### POL-003: 서버 프록시 인증 정보 필수 헤더
- 조건 (코드 원문): `if (!domain || !token) return NextResponse.json({ error: 'Missing Jira credentials' }, { status: 400 })`
- 조건 (비즈니스 번역): 모든 API 요청은 반드시 도메인과 토큰 헤더를 포함해야 한다. 어느 하나라도 누락되면 요청을 처리하지 않는다.
- 위반 시: HTTP 400, "Missing Jira credentials" 오류 반환
- 코드 근거: app/api/jira/route.ts:24-26

#### POL-004: 인증 성공 시에만 다음 단계 진행
- 조건 (코드 원문): `await fetchFromJira('myself', jiraConfig)` 성공 → `setStep(2)`
- 조건 (비즈니스 번역): Jira `/myself` 엔드포인트에서 정상 응답을 받은 경우에만 Step 2(닉네임 설정)로 이동한다. 인증 실패 시 Step 1에 머무른다.
- 위반 시: API 오류 응답을 그대로 화면에 표시하고 Step 1 유지
- 코드 근거: components/poker/CreateRoomWizard.tsx:95-107

#### POL-005: 인증 방식에 따른 API 버전 및 인증 헤더 분기
- 조건 (코드 원문): `const authHeader = email ? 'Basic ...' : 'Bearer ...'`; `const apiVersion = email ? '3' : '2'`
- 조건 (비즈니스 번역): 이메일 헤더 존재 여부로 Cloud/Server를 판단한다. Cloud는 `Basic base64(email:token)`으로 REST API v3에 접근하고, Server·DC는 `Bearer token`으로 REST API v2에 접근한다.
- 위반 시: 잘못된 인증 방식 적용 시 Jira가 401/403 반환
- 코드 근거: app/api/jira/route.ts:34-38

#### POL-006: 인증 정보 서버 미저장 — 매 요청마다 헤더로 전달
- 조건 (코드 원문): `getCredentials(req)` 함수가 매 요청마다 헤더에서 domain/token/email을 읽음; 서버 내 저장 코드 없음
- 조건 (비즈니스 번역): 서버는 Jira 인증 정보를 보관하지 않는다. 클라이언트가 매 요청마다 헤더(`X-Jira-Domain`, `X-Jira-Token`, `X-Jira-Email`)로 직접 전달한다.
- 위반 시: 해당 없음 (설계 원칙)
- 코드 근거: app/api/jira/route.ts:14-19

---

### poker.jira_creds_cache 관련 정책

#### POL-007: 인증 성공 시 로컬 캐싱
- 조건 (코드 원문): `localStorage.setItem(JIRA_CREDS_KEY, JSON.stringify({ authMode, domain, email, token }))`
- 조건 (비즈니스 번역): Jira 인증이 성공하면 인증 정보(인증 방식, 도메인, 이메일, 토큰)를 브라우저 localStorage에 저장한다. 다음 방문 시 폼이 자동으로 채워진다.
- 위반 시: 해당 없음 (편의 기능, 실패해도 try-catch로 무시)
- 코드 근거: components/poker/CreateRoomWizard.tsx:96-101

#### POL-008: 닉네임 캐싱은 Step 2 통과 시점
- 조건 (코드 원문): `localStorage.setItem(JIRA_CREDS_KEY, JSON.stringify({ ...creds, name: name.trim() }))` — Step 2 handleStep2Next 내
- 조건 (비즈니스 번역): 닉네임은 Step 2를 통과할 때 기존 인증 캐시에 추가로 저장된다. 인증 캐시가 없는 경우 닉네임은 저장하지 않는다.
- 위반 시: 해당 없음
- 코드 근거: components/poker/CreateRoomWizard.tsx:117-123

#### POL-009: 저장된 인증 정보 삭제 기능
- 조건 (코드 원문): `localStorage.removeItem(JIRA_CREDS_KEY)` + 상태 초기화 (domain='', email='', token='', authMode='cloud')
- 조건 (비즈니스 번역): 사용자가 "저장된 인증 정보 삭제" 버튼을 누르면 localStorage 캐시를 완전 삭제하고 폼 필드를 모두 초기화한다. 삭제 버튼은 저장된 인증 정보가 있을 때만 표시된다.
- 위반 시: 해당 없음
- 코드 근거: components/poker/CreateRoomWizard.tsx:287-294

#### POL-010: 토큰 평문 저장 (보안 주의)
- 조건 (코드 원문): `localStorage.setItem(..., JSON.stringify({ ..., token: token.trim() }))`
- 조건 (비즈니스 번역): API Token / PAT가 암호화 없이 평문으로 localStorage에 저장된다. 브라우저 개발자 도구에서 직접 확인 가능하다.
- 위반 시: 해당 없음 (현재 설계)
- 코드 근거: components/poker/CreateRoomWizard.tsx:97-99

---

### poker.epic_search 관련 정책

#### POL-011: Epic Key 입력 필수 (서버 측)
- 조건 (코드 원문): `if (!epicKey) return NextResponse.json({ error: 'epicKey is required' }, { status: 400 })`
- 조건 (비즈니스 번역): Epic 조회 API는 epicKey 파라미터 없이 호출할 수 없다. 파라미터가 없으면 요청을 거부한다.
- 위반 시: HTTP 400, "epicKey is required" 반환
- 코드 근거: app/api/jira/route.ts:61-62

#### POL-012: 존재하지 않는 Epic Key 처리
- 조건 (코드 원문): `if (res.status === 404) return NextResponse.json({ error: 'Epic을 찾을 수 없습니다: ...' }, { status: 404 })`
- 조건 (비즈니스 번역): 입력한 Epic Key에 해당하는 이슈가 Jira에 존재하지 않으면 오류를 반환한다.
- 위반 시: HTTP 404, "Epic을 찾을 수 없습니다: {epicKey}" 반환 → UI 에러 박스 표시
- 코드 근거: app/api/jira/route.ts:66-68

#### POL-013: Epic 타입 유효성 검증
- 조건 (코드 원문): `const isEpic = hierarchyLevel === 1 || typeName === 'epic' || typeName === '에픽' || typeName === '큰틀'`; `if (!isEpic) return ...400`
- 조건 (비즈니스 번역): 입력한 키가 이슈 타입 기준으로 Epic(계층 레벨 1, 이름 'epic', '에픽', '큰틀')이 아니면 오류를 반환한다. Story, Task, Bug 등 다른 타입의 이슈 키는 허용하지 않는다.
- 위반 시: HTTP 400, "{key}는 Epic 타입이 아닙니다 ({실제 타입명})" 반환
- 코드 근거: app/api/jira/route.ts:79-88

#### POL-014: Epic 검색 성공 후 하위 이슈 자동 조회
- 조건 (코드 원문): `const epicData = await fetchFromJira('epic', ...)` 성공 직후 `const issueData = await fetchFromJira('issues', ...)`
- 조건 (비즈니스 번역): Epic 유효성이 확인되면 즉시 하위 이슈 목록을 자동으로 조회한다. 별도 버튼 클릭 없이 연속 실행된다.
- 위반 시: 해당 없음 (정상 흐름)
- 코드 근거: components/poker/CreateRoomWizard.tsx:136-141

#### POL-015: Epic Key 변경 시 기존 결과 초기화
- 조건 (코드 원문): `setFoundEpic(null); setTickets([]); setEpicError('')` — handleEpicKeyChange
- 조건 (비즈니스 번역): 사용자가 Epic Key 입력 필드를 수정하면 이전 검색 결과(Epic 미리보기, 이슈 목록)와 오류 메시지가 즉시 초기화된다.
- 위반 시: 해당 없음 (UX 정책)
- 코드 근거: components/poker/CreateRoomWizard.tsx:150-155

---

### poker.issues_fetch 관련 정책

#### POL-016: 이슈 조회 최대 100건 제한
- 조건 (코드 원문): `maxResults: 100` (Cloud POST body); `maxResults=100` (Server query string)
- 조건 (비즈니스 번역): 에픽 하위 이슈는 최대 100건까지만 조회한다. 100건을 초과하는 경우 101번째 이후 이슈는 세션에 포함되지 않는다.
- 위반 시: 해당 없음 (시스템 한도)
- 코드 근거: app/api/jira/route.ts:104, 122

#### POL-017: Cloud와 Server·DC 이슈 조회 방식 분기
- 조건 (코드 원문): Cloud: `POST /rest/api/3/search/jql` + `parent = epicKey` JQL; Server: `GET /rest/api/2/search?jql="Epic Link" = epicKey`
- 조건 (비즈니스 번역): Cloud는 `parent` 관계로 하위 이슈를 조회하고, Server·DC는 `"Epic Link"` 필드로 조회한다. 두 방식은 서로 다른 Jira 버전의 데이터 구조 차이를 반영한다.
- 위반 시: 해당 없음 (분기 설계)
- 코드 근거: app/api/jira/route.ts:99-125

#### POL-018: Cloud ADF 설명 평문 변환
- 조건 (코드 원문): `if (isCloud && typeof f.description === 'object') { description = extractAdfText(f.description) }`
- 조건 (비즈니스 번역): Cloud Jira의 이슈 설명은 ADF(Atlassian Document Format) 구조로 전달되므로 서버에서 평문으로 변환하여 클라이언트에 반환한다. Server·DC의 설명은 이미 평문/HTML이므로 그대로 전달한다.
- 위반 시: 해당 없음 (변환 누락 시 ADF 객체 문자열이 UI에 표시됨)
- 코드 근거: app/api/jira/route.ts:143-147

#### POL-019: 이슈 0건인 경우 방 만들기 비활성화
- 조건 (코드 원문): `disabled={!foundEpic || tickets.length === 0}`
- 조건 (비즈니스 번역): Epic이 확인되었더라도 하위 이슈가 없으면 "방 만들기" 버튼이 비활성화된다. 투표 대상 티켓이 없는 방은 생성할 수 없다.
- 위반 시: 해당 없음 (버튼 비활성화로 차단)
- 코드 근거: components/poker/CreateRoomWizard.tsx:416

#### POL-020: Story Points 필드 고정 식별자 사용
- 조건 (코드 원문): `storyPoints: f.customfield_10016 ?? undefined`
- 조건 (비즈니스 번역): Story Points 값은 Jira의 커스텀 필드 `customfield_10016`에서 읽는다. 이 필드 ID는 Jira Cloud 표준으로, 다른 인스턴스에서는 다를 수 있다.
- 위반 시: 해당 없음 (읽기 실패 시 undefined 처리)
- 코드 근거: app/api/jira/route.ts:153

#### POL-021: 이슈 조회 대상 타입 필터
- 조건 (코드 원문): Server JQL: `issuetype in (Story, Task, Bug)`; Cloud JQL: `parent = epicKey` (타입 제한 없음)
- 조건 (비즈니스 번역): Server·DC 모드에서는 Story, Task, Bug 타입만 하위 이슈로 가져온다. Cloud 모드에서는 `parent` 관계의 모든 하위 이슈를 가져온다.
- 위반 시: 해당 없음 (필터 설계)
- 코드 근거: app/api/jira/route.ts:99-101, 111-114

#### POL-022: 닉네임 필수 입력
- 조건 (코드 원문): `if (!name.trim()) { setError('닉네임을 입력해주세요.'); return }`
- 조건 (비즈니스 번역): 닉네임은 공백 트리밍 후 비어 있으면 Step 3으로 진행할 수 없다.
- 위반 시: "닉네임을 입력해주세요." 오류 메시지 표시, Step 2에서 이동 불가
- 코드 근거: components/poker/CreateRoomWizard.tsx:113-116

---

## 에러 시나리오

- ERR-001: "모든 필드를 입력해주세요."
  - 발생 조건: Cloud 모드에서 도메인, 이메일, 토큰 중 하나라도 비어 있거나; Server 모드에서 도메인 또는 토큰이 비어 있는 상태에서 다음 버튼 클릭
  - 사용자 영향: Step 1 폼 하단에 오류 메시지 표시, 다음 단계로 이동 불가
  - 대응 방법: 모든 필수 입력란을 채우고 다시 시도
  - 코드 근거: components/poker/CreateRoomWizard.tsx:87-90

- ERR-002: "닉네임을 입력해주세요."
  - 발생 조건: Step 2에서 닉네임 입력란을 비운 채 다음 버튼 클릭
  - 사용자 영향: Step 2 폼 하단에 오류 메시지 표시, Step 3 진입 불가
  - 대응 방법: 닉네임을 입력하고 다시 시도
  - 코드 근거: components/poker/CreateRoomWizard.tsx:113-116

- ERR-003: "인증 실패: {HTTP 상태코드} {Jira 응답 본문}"
  - 발생 조건: /myself 엔드포인트 호출 시 Jira가 비정상 응답(401, 403 등) 반환
  - 사용자 영향: Step 1 폼 하단에 오류 메시지 표시
  - 대응 방법: 도메인, 이메일(Cloud), 토큰을 다시 확인하고 재입력
  - 코드 근거: app/api/jira/route.ts:51-54

- ERR-004: "Missing Jira credentials"
  - 발생 조건: 도메인 또는 토큰 헤더가 없는 상태에서 프록시 API 직접 호출
  - 사용자 영향: API 레벨에서 차단; 정상적인 UI 흐름에서는 발생하지 않음
  - 대응 방법: 정상 UI를 통해 인증 정보 입력 후 재시도
  - 코드 근거: app/api/jira/route.ts:24-26

- ERR-005: "Epic을 찾을 수 없습니다: {epicKey}"
  - 발생 조건: 입력한 Epic Key가 Jira 인스턴스에 존재하지 않는 경우
  - 사용자 영향: Step 3 에러 박스에 오류 메시지 표시
  - 대응 방법: Epic Key를 올바르게 입력했는지 확인(예: PROJ-42); 접근 권한이 있는지 확인
  - 코드 근거: app/api/jira/route.ts:66-68

- ERR-006: "{epicKey}는 Epic 타입이 아닙니다 ({실제 타입명})"
  - 발생 조건: 입력한 키가 Jira에 존재하지만 Epic 타입이 아닌 이슈(Story, Task 등)인 경우
  - 사용자 영향: Step 3 에러 박스에 오류 메시지 표시
  - 대응 방법: Epic 타입의 이슈 키를 입력해야 함; Jira에서 Epic 타입 이슈의 키를 확인하여 재입력
  - 코드 근거: app/api/jira/route.ts:81-88

- ERR-007: "Jira error: {HTTP 상태코드} {응답 본문}"
  - 발생 조건: Epic 조회 또는 이슈 목록 조회 시 Jira가 예상치 못한 오류 반환(404 제외)
  - 사용자 영향: Step 3 에러 박스에 오류 메시지 표시
  - 대응 방법: Jira 인스턴스 상태 및 접근 권한 확인; 잠시 후 재시도
  - 코드 근거: app/api/jira/route.ts:69-74

- ERR-008: "Invalid type parameter"
  - 발생 조건: 지원하지 않는 type 파라미터로 프록시 API 직접 호출
  - 사용자 영향: API 레벨에서 차단; 정상 UI 흐름에서는 발생하지 않음
  - 대응 방법: 정상 UI를 통해 이용
  - 코드 근거: app/api/jira/route.ts:177

- ERR-009: (네트워크/서버 오류) 예외 발생 시 err.message 또는 "Unknown error"
  - 발생 조건: Jira 서버 연결 불가 또는 서버 내부 처리 중 예외 발생
  - 사용자 영향: HTTP 500 응답; FE에서는 에러 메시지 박스에 표시
  - 대응 방법: 네트워크 연결 상태 확인; Jira 도메인 주소가 정확한지 확인
  - 코드 근거: app/api/jira/route.ts:178-181

---

## 상수/설정값

- 이슈 조회 최대 건수: 100건
  - 코드 근거: app/api/jira/route.ts:104, 122

- 인증 정보 localStorage 키: 'jira-joker-credentials'
  - 코드 근거: components/poker/CreateRoomWizard.tsx:34

- Story Points 커스텀 필드 ID: 'customfield_10016'
  - 코드 근거: app/api/jira/route.ts:115, 153

- Cloud REST API 버전: v3 (/rest/api/3)
  - 코드 근거: app/api/jira/route.ts:37-38

- Server·DC REST API 버전: v2 (/rest/api/2)
  - 코드 근거: app/api/jira/route.ts:37-38

- Epic 타입 인식 이름: 'epic', '에픽', '큰틀', 또는 계층 레벨(hierarchyLevel) = 1
  - 코드 근거: app/api/jira/route.ts:80

---

## 용어

- Jira Cloud: Atlassian이 운영하는 SaaS 버전 Jira. `atlassian.net` 도메인 사용, REST API v3, Basic Auth(email+token) 방식.
- Jira Server·DC: 자체 서버에 설치하는 Jira(Server 또는 Data Center). Base URL 직접 입력, REST API v2, Bearer PAT 방식.
- API Token: Jira Cloud에서 발급하는 인증 토큰. 계정 이메일과 함께 Basic Auth에 사용.
- Personal Access Token(PAT): Jira Server·DC에서 발급하는 개인 접근 토큰. Bearer 인증에 단독 사용.
- Epic: Jira의 이슈 계층 중 상위 단위. 여러 Story/Task/Bug를 묶는 그룹.
- Epic Key: 에픽 이슈의 고유 식별자(예: PROJ-42). 알파벳 프로젝트 코드와 숫자로 구성.
- Story Points: 이슈 작업량을 상대적 수치로 표현하는 Agile 추정 단위. Jira의 customfield_10016에 저장.
- ADF (Atlassian Document Format): Jira Cloud v3 API에서 이슈 설명을 표현하는 JSON 구조 포맷. 평문 변환 필요.
- 인증 캐시: 사용자 편의를 위해 브라우저 localStorage에 저장하는 Jira 인증 정보 사본. 평문 저장.
- 방 만들기: Epic과 하위 이슈 목록이 확보된 후 Planning Poker 세션을 시작하는 행위.
