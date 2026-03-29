# Jira 연동 도메인 - 용어집

> 최종 갱신: 2026-03-29

---

## 가나다 순

### API 토큰 (API Token)
- **정의**: Jira Cloud에서 사용하는 인증 토큰. Atlassian 계정 설정에서 발급하며, 계정 이메일과 함께 조합하여 인증에 사용한다.
- **혼동 주의**: PAT(Personal Access Token)와 다르다. API 토큰은 Cloud 전용이며 이메일과 함께 사용해야 한다. PAT는 Server·DC 전용이며 단독으로 사용한다.
- **예시**: Atlassian 계정 보안 설정에서 "API 토큰 만들기"로 발급받은 문자열

### ADF (Atlassian Document Format)
- **정의**: Jira Cloud API v3에서 이슈 설명을 표현하는 JSON 기반 구조화 문서 형식. 단락, 코드 블록, 링크 등 서식 정보를 포함한다.
- **혼동 주의**: 일반 텍스트가 아니다. 이 시스템은 ADF를 평문으로 자동 변환하여 사용한다. 첨부파일이나 특수 미디어 노드는 변환 결과에서 누락될 수 있다.
- **예시**: `{ "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "작업 내용" }] }] }`

### Epic
- **정의**: Jira 이슈 계층 구조에서 Story/Task/Bug의 상위 단위. 이 시스템에서는 하나의 Planning Poker 세션 범위를 정의하는 기준이 된다.
- **혼동 주의**: Story, Task, Bug는 포커 세션의 투표 대상 이슈이며 Epic이 될 수 없다. Epic은 직접 투표하지 않고 범위 설정에만 사용한다. 이슈 타입 이름은 Jira 인스턴스에 따라 'epic', '에픽', '큰틀'로 다를 수 있으며, 이 시스템은 세 가지 모두를 Epic으로 인정한다.
- **예시**: PROJ-42 (이슈 타입이 Epic인 이슈)

### Epic Key
- **정의**: Jira에서 이슈를 식별하는 고유 키. 프로젝트 접두사와 이슈 번호를 하이픈으로 연결한 형태이다.
- **혼동 주의**: Epic ID(Jira 내부 숫자 ID)와 다르다. 사용자에게 표시되는 키 형식을 사용해야 한다.
- **예시**: PROJ-42, MYAPP-100

### JQL (Jira Query Language)
- **정의**: Jira 이슈를 검색하는 쿼리 언어. 이 시스템은 JQL로 Epic 하위 이슈를 조회한다.
- **혼동 주의**: Cloud와 Server·DC에서 일부 JQL 문법이 다르다. Cloud는 `parent = {키}` 형식을 사용하고, Server·DC는 `"Epic Link" = {키}` 형식을 사용한다.
- **예시**: `parent = PROJ-42 ORDER BY created DESC`

### Jira Cloud
- **정의**: Atlassian이 SaaS 형태로 호스팅하는 Jira 서비스. `*.atlassian.net` 도메인을 사용하며, 이메일 + API 토큰으로 인증한다.
- **혼동 주의**: Jira Server·DC와 인증 방식, API 버전, 이슈 조회 방식이 모두 다르다.
- **예시**: `your-org.atlassian.net`

### Jira Server·DC
- **정의**: 기업이 자체 서버에 설치하여 운영하는 Jira. Jira Server(구버전)와 Jira Data Center(최신 자체 호스팅)를 합쳐서 지칭한다. Personal Access Token만으로 인증한다.
- **혼동 주의**: Cloud와 달리 이메일 없이 PAT 단독으로 인증한다. API v2를 사용하며 이슈 설명이 ADF가 아닌 평문 또는 HTML로 제공된다.
- **예시**: `https://jira.your-company.com`

### PAT (Personal Access Token)
- **정의**: Jira Server·DC에서 사용하는 인증 토큰. Jira 사용자 설정에서 발급하며 Bearer 방식으로 단독 사용한다.
- **혼동 주의**: API 토큰(Cloud 전용)과 다르다. PAT는 Server·DC 전용이며 이메일 없이 사용한다.
- **예시**: Jira Server 프로필 → Personal Access Tokens에서 발급받은 문자열

### Story Points
- **정의**: 이슈의 작업 규모나 복잡도를 나타내는 상대적 수치. Planning Poker의 투표 대상 값이다. Jira Cloud에서는 특정 커스텀 필드(Jira Cloud 표준 필드)에 저장된다.
- **혼동 주의**: 시간 기반 추정(시간, 일수)과 다르다. 이 시스템에서 Story Points는 투표 결과로 결정되며, 기존 Jira의 값은 세션에서 참고용으로만 표시된다. 필드 번호가 다른 Jira 인스턴스에서는 기존 값을 가져오지 못할 수 있다.
- **예시**: 1, 2, 3, 5, 8, 13 (피보나치 수열 기반 포인트 값)

### 자격증명 캐시
- **정의**: 재방문 시 폼 자동 입력을 위해 인증 모드, 도메인, 이메일(Cloud), 토큰, 닉네임을 브라우저 로컬 저장소에 보관하는 기능. 인증 검증 성공 시에만 저장된다.
- **혼동 주의**: 서버에 저장되지 않는다. 브라우저 로컬 저장소에만 보관되므로 다른 브라우저나 기기에서는 자동 입력되지 않는다. 토큰이 평문으로 저장되므로 공용 기기에서는 삭제 버튼으로 제거하는 것이 권장된다.
- **예시**: 로컬 저장소 키 `jira-joker-credentials`에 JSON 형태로 저장

### 프록시 API
- **정의**: 브라우저와 Jira REST API 사이에서 중계 역할을 하는 서버 측 API. 자격증명을 브라우저에 직접 노출하지 않고 서버 측에서 Jira에 요청을 전달한다.
- **혼동 주의**: 자격증명을 서버 측에 영구 저장하지 않는다. 매 요청마다 클라이언트가 헤더로 자격증명을 전달하고, 프록시는 이를 Jira로 중계하는 역할만 한다.
- **예시**: 인증 검증, Epic 조회, 이슈 목록 조회가 모두 이 프록시를 통해 처리된다.
