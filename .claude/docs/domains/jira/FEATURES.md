# Jira 연동 도메인 - 기능 목록

> 최종 갱신: 2026-03-25

---

## jira.인증_검증

- **설명**: Jira 인증 정보(domain, email, token)를 입력받아 `/api/jira?type=myself`로 유효성을 검증한다. 성공 시 인증 정보를 localStorage에 캐싱하고 다음 단계(닉네임 설정)로 진행한다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` — Step 1, `handleStep1Next()`
  - BE: `app/api/jira/route.ts` — GET handler, `type === 'myself'` 분기
  - API: `GET /api/jira?type=myself`
- **주요 엔티티**: JiraConfig
- **영향을 줌 (impacts)**:
  - `jira.에픽_조회` — 검증 성공 시 확정된 JiraConfig가 이후 모든 API 호출에 사용됨
    - 트리거: handleStep1Next() 성공 후 step이 2로 전환되고, Step 3에서 Epic 검색 시 동일 JiraConfig 사용
    - 영향 범위: JiraConfig(domain, token, email) 값이 에픽 조회 및 이슈 조회의 인증 헤더로 전달됨
  - `jira.이슈_목록_조회` — 동일 이유로 JiraConfig가 공유됨
    - 트리거: 동일
    - 영향 범위: 동일
- **영향을 받음 (affected_by)**:
  - (없음 — 최상위 진입 기능. localStorage 캐시 로드는 UX 편의 목적이며 동작 변경 없음)
- **변경 시 체크리스트**:
  - [ ] Cloud/Server 분기 조건(email 존재 여부) 변경 시 → BE `getCredentials()` 로직 및 FE authMode 토글 동작 동시 확인
  - [ ] localStorage 캐시 키(`jira-joker-credentials`) 변경 시 → CreateRoomWizard useEffect 로드 로직과 동기화 확인
  - [ ] `/api/jira` 응답 포맷 변경 시 → FE `fetchFromJira<{ displayName: string }>` 타입 일치 여부 확인

---

## jira.에픽_조회

- **설명**: 사용자가 입력한 Epic 키로 Jira 이슈를 조회하고 Epic 타입(hierarchyLevel, issuetype.name) 여부를 검증한다. 유효하면 Epic 정보(key, summary)를 반환하고 이슈 목록 조회를 이어서 수행한다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` — Step 3, `handleSearchEpic()` 내 `fetchFromJira('epic', ...)`
  - BE: `app/api/jira/route.ts` — GET handler, `type === 'epic'` 분기
  - API: `GET /api/jira?type=epic&epicKey={epicKey}`
- **주요 엔티티**: JiraEpic
- **영향을 줌 (impacts)**:
  - `jira.이슈_목록_조회` — Epic 조회 성공 후 즉시 이슈 목록 조회가 이어서 호출됨
    - 트리거: `handleSearchEpic()` 내에서 epic 조회 성공 즉시 issues 조회 연쇄 실행
    - 영향 범위: foundEpic 상태와 epicKey가 이슈 조회의 입력으로 사용됨
  - `poker.방_생성_위저드` — 조회된 Epic의 이슈 목록이 `createRoom`의 tickets 인자로 전달됨
    - 트리거: handleCreateRoom() 호출 시 foundEpic과 tickets 상태가 검증되어 createRoom으로 전달
    - 영향 범위: PokerState.tickets 초기값, PokerState.jiraConfig 결정
- **영향을 받음 (affected_by)**:
  - `jira.인증_검증` — 검증된 JiraConfig 없이 호출 불가 (Step 1 성공 후에만 Step 3 진입 가능)
    - 의존 필드: JiraConfig.domain, JiraConfig.token, JiraConfig.email
- **변경 시 체크리스트**:
  - [ ] Epic 판별 조건(hierarchyLevel, typeName) 변경 시 → Cloud/Server 양쪽 Jira 환경에서 동작 확인
  - [ ] BE 응답 구조 `{ epic: { id, key, summary } }` 변경 시 → FE `fetchFromJira<{ epic: JiraEpic }>` 타입 일치 여부 확인
  - [ ] epicKey 필수 검증 로직 제거 시 → BE 400 에러 처리 경로가 FE에서 적절히 처리되는지 확인

---

## jira.이슈_목록_조회

- **설명**: Epic 하위의 Story/Task/Bug 이슈를 최대 100건 조회한다. Cloud는 POST /search/jql (parent = epicKey), Server·DC는 GET /search?jql=Epic Link= 방식으로 자동 분기하며, ADF description을 평문으로 변환하여 반환한다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` — Step 3, `handleSearchEpic()` 내 `fetchFromJira('issues', ...)`
  - BE: `app/api/jira/route.ts` — GET handler, `type === 'issues'` 분기
  - API: `GET /api/jira?type=issues&epicKey={epicKey}`
- **주요 엔티티**: JiraTicket
- **영향을 줌 (impacts)**:
  - `poker.방_생성_위저드` — 조회된 JiraTicket 배열이 `createRoom(name, jiraConfig, tickets)` 호출로 포커 세션 초기 티켓 목록을 구성
    - 트리거: handleCreateRoom() 클릭 시 tickets 상태(조회 결과)를 createRoom 인자로 전달
    - 영향 범위: PokerState.tickets 초기값 전체, currentTicketIndex 시작점(0)
- **영향을 받음 (affected_by)**:
  - `jira.에픽_조회` — epicKey 확정 및 Epic 유효성 검증 이후에만 호출됨
    - 의존 필드: epicKey (handleSearchEpic에서 동일 key 공유)
  - `jira.인증_검증` — JiraConfig의 email 존재 여부가 Cloud/Server 분기를 결정
    - 의존 필드: JiraConfig.email (email 있으면 Cloud POST, 없으면 Server GET)
- **변경 시 체크리스트**:
  - [ ] Cloud JQL 변경(`parent = epicKey` → 다른 조건) 시 → Server JQL(`"Epic Link" = epicKey`)과 결과 일관성 확인
  - [ ] 반환 필드 목록(summary, customfield_10016, description, assignee, reporter, duedate, priority) 변경 시 → JiraTicket 인터페이스 및 FE 표시 컴포넌트 동시 확인
  - [ ] ADF 파싱(`extractAdfText`) 로직 변경 시 → Cloud 환경에서 다양한 ADF node 타입(bulletList, heading 등) 렌더링 결과 확인
  - [ ] maxResults 100 상한 변경 시 → 대형 Epic에서의 성능 및 응답 시간 확인
  - [ ] customfield_10016 필드명 변경 시 → `poker.티켓_패널`(TicketDetail)의 storyPoints 표시 및 `poker.세션_완료`(SessionSummary)의 SP 합산 정상 여부 확인
