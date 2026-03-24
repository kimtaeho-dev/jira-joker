# Jira 연동 도메인 - 용어집

> 최종 갱신: 2026-03-25

---

## A

### ADF (Atlassian Document Format)
- **정의**: Jira Cloud API v3가 description 필드 등 리치 텍스트를 반환할 때 사용하는 구조화된 JSON 문서 형식. 단락, 목록, 제목 등 다양한 노드 타입으로 구성된 트리 구조
- **코드 표현**: `f.description` (object 타입일 때), `extractAdfText()` 함수로 평문 변환
- **유사어·혼동 주의**: Server/DC API v2는 description을 plain text 또는 HTML 문자열로 반환하므로 ADF 변환이 불필요. Cloud 전용 개념
- **사용 위치**: JiraTicket.description 필드, `jira.이슈_목록_조회` 기능
- **예시**: `{ "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "설명 본문" }] }] }`

### authMode (인증 모드)
- **정의**: 연결 대상 Jira 환경을 구분하는 설정값. 'cloud' 또는 'server' 두 가지 값만 가짐. 이 값에 따라 이메일 필수 여부, 인증 방식(Basic/Bearer), API 버전(v3/v2)이 모두 결정됨
- **코드 표현**: `authMode: 'cloud' | 'server'` (CreateRoomWizard 상태), `JIRA_CREDS_KEY`에 함께 저장
- **유사어·혼동 주의**: "Cloud"는 Atlassian Cloud(atlassian.net 도메인), "server"는 Jira Server 및 Data Center 모두를 포함
- **사용 위치**: `jira.인증_검증` 기능, JiraConfig 생성 시 분기 조건
- **예시**: 'cloud' → email 필드 활성화, Basic auth; 'server' → email 필드 숨김, Bearer auth

---

## C

### customfield_10016 (스토리 포인트 필드 ID)
- **정의**: Jira Cloud에서 Story Points(스토리 포인트) 추정치를 저장하는 커스텀 필드의 내부 ID. Jira가 자동 부여하는 ID이므로 다른 Jira 인스턴스에서는 다를 수 있음
- **코드 표현**: `f.customfield_10016`, `JiraTicket.storyPoints`
- **유사어·혼동 주의**: 이 ID는 Jira Cloud 기본값이며, 커스터마이징된 Jira 환경에서는 다른 ID를 사용할 수 있음. Server/DC에서는 동일하게 적용되지 않을 수 있음
- **사용 위치**: `jira.이슈_목록_조회` 기능, JiraTicket 엔티티
- **예시**: `f.customfield_10016 = 5` → storyPoints: 5

---

## E

### epicKey (에픽 키)
- **정의**: Jira Epic 이슈의 프로젝트 내 고유 키. Planning Poker 세션의 범위를 결정하는 출발점으로, 이 Epic의 하위 이슈들이 포커 세션의 티켓 목록이 됨
- **코드 표현**: `epicKeyInput` (FE 상태), `epicKey` (API 쿼리 파라미터), `JiraEpic.key`
- **유사어·혼동 주의**: `JiraTicket.key`와 형식은 동일하나(예: PROJ-42) Epic 타입 이슈에만 해당. 일반 이슈 키를 입력하면 POL-007 위반으로 오류 발생
- **사용 위치**: `jira.에픽_조회` 기능, `jira.이슈_목록_조회` 기능
- **예시**: "PROJ-42", "BACKEND-100"

---

## H

### hierarchyLevel (이슈 계층 레벨)
- **정의**: Jira 이슈 타입의 계층 수준을 나타내는 숫자. Epic은 1, 하위 이슈(Story, Task 등)는 0 이하
- **코드 표현**: `data.fields?.issuetype?.hierarchyLevel`
- **유사어·혼동 주의**: issuetype.name이 'Epic'이어도 Jira 버전이나 언어 설정에 따라 다른 이름('에픽', '큰틀')을 쓸 수 있으므로 hierarchyLevel을 1차 판별 기준으로 사용하고 이름을 보조 기준으로 사용
- **사용 위치**: `jira.에픽_조회` 기능, Epic 타입 검증 로직
- **예시**: Epic → hierarchyLevel: 1; Story → hierarchyLevel: 0

---

## J

### JiraConfig (Jira 설정 객체)
- **정의**: Jira 연동에 필요한 인증 정보를 하나로 묶은 객체. 세션 생성 시 포커 상태에 저장되어 이후 모든 API 호출에 재사용됨
- **코드 표현**: `JiraConfig` (타입), `usePokerStore.jiraConfig` (저장 위치)
- **유사어·혼동 주의**: 인증 정보가 서버 측에 저장되지 않고 클라이언트가 매 요청마다 헤더로 전달하는 구조. 서버는 상태를 보유하지 않음
- **사용 위치**: `jira.인증_검증`, `jira.에픽_조회`, `jira.이슈_목록_조회` 전 기능
- **예시**: `{ domain: "company.atlassian.net", token: "ATATT3x...", email: "user@company.com" }`

### JiraEpic (에픽 조회 결과 객체)
- **정의**: Jira Epic 조회 응답에서 방 생성 위저드에 필요한 최소 정보(id, key, summary)만 추출한 로컬 객체. Epic 조회 성공 여부를 UI에 표시하고 이슈 목록 조회의 입력으로 사용됨
- **코드 표현**: `JiraEpic` 인터페이스 (CreateRoomWizard 로컬), `foundEpic` 상태
- **유사어·혼동 주의**: JiraTicket과 구조는 비슷하나 훨씬 간소화된 별도 타입. Epic 자체가 포커 추정의 대상이 되는 것이 아니라 하위 이슈 목록 조회의 컨테이너 역할만 함
- **사용 위치**: `jira.에픽_조회` 기능
- **예시**: `{ id: "10001", key: "PROJ-42", summary: "Q1 백엔드 리팩토링" }`

### JiraTicket (Jira 티켓)
- **정의**: Planning Poker의 추정 단위. Jira Epic 하위의 Story, Task, Bug 이슈 1건을 나타내는 객체로, 세션 생성 시 배열 형태로 저장되어 순차적으로 추정됨
- **코드 표현**: `JiraTicket` (타입), `tickets` (FE 상태), `PokerState.tickets`
- **유사어·혼동 주의**: 세션 생성 후 변경되지 않는 읽기 전용 스냅샷. 투표 결과는 별도의 CompletedTicket 객체에 기록됨
- **사용 위치**: `jira.이슈_목록_조회` 기능, poker 도메인 전체
- **예시**: `{ id: "20001", key: "PROJ-43", summary: "로그인 API 구현", storyPoints: undefined, ... }`

---

## P

### PAT (Personal Access Token / 개인 액세스 토큰)
- **정의**: Jira Server·Data Center에서 API 인증에 사용하는 개인 발급 토큰. Bearer 방식으로 전송되며 이메일 없이 단독으로 사용됨
- **코드 표현**: `token` 필드 (authMode === 'server'일 때), `Authorization: Bearer {token}`
- **유사어·혼동 주의**: Jira Cloud의 "API Token"과 이름이 유사하지만 다른 개념. Cloud API Token은 Basic auth(email:token)에서 비밀번호 역할을 하며, PAT은 Bearer 토큰으로 단독 사용. 두 토큰의 발급 방식과 형식도 다름
- **사용 위치**: `jira.인증_검증` 기능, JiraConfig.token 필드
- **예시**: Server/DC 관리 화면에서 발급한 문자열 토큰

---
