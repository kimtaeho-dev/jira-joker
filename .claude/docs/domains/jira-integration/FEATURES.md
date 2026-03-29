# Jira 연동 도메인 - 기능 목록
> 최종 갱신: 2026-03-28

---

## poker.jira_auth_validate
- **설명**: 사용자가 입력한 Jira 도메인·이메일(Cloud만)·토큰을 프록시 API를 통해 `/myself` 엔드포인트로 검증한다. 성공 시 인증 정보를 localStorage(`jira-joker-credentials`)에 캐싱하고 Step 2로 진행한다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` (`handleStep1Next`)
  - BE: `app/api/jira/route.ts` (`type=myself` 분기)
  - API: `GET /api/jira?type=myself`
- **주요 엔티티**: JiraConfig
- **영향을 줌 (impacts)**:
  - `poker.jira_creds_cache` — 인증 성공 시 localStorage에 캐싱 트리거
    - 트리거: handleStep1Next 성공 시
    - 영향 범위: localStorage `jira-joker-credentials` 키 갱신
  - `poker.epic_search` — 인증 성공 후 Step 3 진입 허용
    - 트리거: Step 1 통과 → Step 2 → Step 3 순차 진행
    - 영향 범위: Jira API 호출에 사용되는 인증 헤더 값
- **영향을 받음 (affected_by)**:
  - `poker.jira_creds_cache` — 캐시된 인증정보로 폼 자동 채움
    - 의존 필드: authMode, domain, email, token
- **변경 시 체크리스트**:
  - [ ] Cloud/Server 양쪽 authMode에서 인증 검증 동작 확인
  - [ ] 인증 실패 시 오류 메시지가 UI에 표시되는지 확인
  - [ ] 성공 시 localStorage에 authMode·domain·email·token이 올바르게 저장되는지 확인
  - [ ] `x-jira-domain` / `x-jira-email` / `x-jira-token` 헤더 전달 누락 여부 확인

---

## poker.jira_creds_cache
- **설명**: Jira 인증 정보(authMode, domain, email, token)와 호스트 닉네임을 localStorage에 저장·복원·삭제하여 페이지 재방문 시 폼을 자동으로 채워준다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` (마운트 시 `useEffect` 복원, `handleStep1Next` 저장, `handleStep2Next` 닉네임 추가, 삭제 버튼 onClick)
  - BE: 없음
  - API: 없음
- **주요 엔티티**: JiraConfig
- **영향을 줌 (impacts)**:
  - `poker.jira_auth_validate` — 폼 자동 채움으로 재인증 편의 제공
    - 트리거: CreateRoomWizard 마운트 시 useEffect
    - 영향 범위: Step 1 폼 필드 (authMode, domain, email, token)
- **영향을 받음 (affected_by)**:
  - `poker.jira_auth_validate` — 인증 성공 시 캐시 저장 트리거
    - 의존 필드: authMode, domain, email, token
- **변경 시 체크리스트**:
  - [ ] localStorage 키(`jira-joker-credentials`) 변경 시 기존 캐시 마이그레이션 처리 여부 확인
  - [ ] token 값이 localStorage에 평문 저장되는 보안 리스크 인지 (민감 데이터 암호화 고려)
  - [ ] 삭제 버튼 클릭 후 폼 필드가 모두 초기화되는지 확인

---

## poker.epic_search
- **설명**: Step 3에서 입력한 Epic Key로 Jira 에픽 단건을 조회하고, 서버 측에서 issuetype hierarchyLevel 또는 name 기반으로 Epic 유효성을 검증한다. 유효하지 않은 이슈 타입이면 400 오류를 반환한다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` (`handleSearchEpic` 내 `fetchFromJira('epic', ...)`)
  - BE: `app/api/jira/route.ts` (`type=epic` 분기)
  - API: `GET /api/jira?type=epic&epicKey={key}`
- **주요 엔티티**: JiraEpic
- **영향을 줌 (impacts)**:
  - `poker.issues_fetch` — 유효 Epic 확인 후 하위 이슈 목록 자동 조회
    - 트리거: handleSearchEpic에서 Epic 유효성 확인 성공 직후
    - 영향 범위: epicKey 값 전달
- **영향을 받음 (affected_by)**:
  - `poker.jira_auth_validate` — 인증 성공 후 Step 3 진입 가능
    - 의존 필드: JiraConfig (domain, token, email)
- **변경 시 체크리스트**:
  - [ ] 커스텀 Epic 타입명(예: '큰틀') 추가 시 `route.ts`의 isEpic 판별 조건 갱신 필요
  - [ ] hierarchyLevel이 없는 구버전 Jira Server에서 에픽 판별 fallback 동작 확인
  - [ ] 존재하지 않는 키 입력 시 404 오류 메시지가 UI에 표시되는지 확인

---

## poker.issues_fetch
- **설명**: 유효 Epic 확인 후 해당 에픽의 하위 이슈(Story/Task/Bug) 목록을 최대 100건 조회한다. Cloud는 `POST /search/jql` + `parent = epicKey` JQL을 사용하고, Server·DC는 `GET /search?jql="Epic Link"=epicKey` 방식으로 분기하여 양쪽 버전을 지원한다.
- **코드 위치**:
  - FE: `components/poker/CreateRoomWizard.tsx` (`handleSearchEpic` 내 `fetchFromJira('issues', ...)`)
  - BE: `app/api/jira/route.ts` (`type=issues` 분기)
  - API: `GET /api/jira?type=issues&epicKey={key}`
- **주요 엔티티**: JiraTicket
- **영향을 줌 (impacts)**:
  - `poker.카드_선택` — JiraTicket[] → createRoom() → 투표 대상 티켓 설정
    - 트리거: "방 만들기" 버튼 클릭 시 createRoom(name, jiraConfig, tickets) 호출
    - 영향 범위: PokerState.tickets 전체, 게임 진행의 기반 데이터
  - `poker.티켓_패널` — JiraTicket 상세(description, assignee, priority 등) → 패널 표시
    - 트리거: 방 생성 즉시
    - 영향 범위: TicketDetail, TicketHistory 컴포넌트 렌더링 데이터
- **영향을 받음 (affected_by)**:
  - `poker.epic_search` — 유효 Epic 확인 후 자동 조회 트리거
    - 의존 필드: epicKey
- **변경 시 체크리스트**:
  - [ ] Cloud ADF description 파싱(`extractAdfText`) 변경 시 모든 노드 타입 커버 여부 확인
  - [ ] `customfield_10016` 외 다른 Story Points 커스텀 필드를 사용하는 인스턴스 대응 방안 검토
  - [ ] maxResults=100 초과 이슈 페이지네이션 처리 필요 여부 확인
  - [ ] Server·DC에서 `"Epic Link"` 필드명이 다른 경우(예: 한국어 Jira) JQL 실패 가능성 점검
  - [ ] 이슈가 0건인 경우 UI에서 방 만들기 버튼이 비활성화되는지 확인
