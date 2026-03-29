# Jira 연동 도메인 - 엔티티 정의
> 최종 갱신: 2026-03-28

## JiraConfig
- **설명**: Jira 인스턴스에 인증하기 위한 접속 정보. Cloud(Basic auth)와 Server·DC(Bearer PAT) 두 가지 인증 방식을 하나의 구조로 표현한다.
- **코드 위치**: `store/usePokerStore.ts` (line 11)
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | domain | string | Jira 인스턴스 도메인 또는 Base URL (예: `your-org.atlassian.net` 또는 `https://jira.company.com`) | - |
  | token | string | Cloud: API Token / Server·DC: Personal Access Token | - |
  | email | string? | Cloud 인증 시 필수 계정 이메일; Server·DC에서는 omit | - |
- **관계**: `usePokerStore.jiraConfig` 필드로 저장됨. 방 생성 시 `createRoom()` 인자로 전달되어 스토어에 보관된 후 WebRTC sync_response를 통해 호스트 상태에 포함된다. API 프록시 호출 시 매 요청마다 `x-jira-domain` / `x-jira-email` / `x-jira-token` 헤더로 전달.

---

## JiraTicket
- **설명**: Jira 이슈 단건 데이터. Epic 하위 Story / Task / Bug 항목을 표현하며 Planning Poker 세션의 투표 대상 티켓으로 사용된다.
- **코드 위치**: `store/usePokerStore.ts` (line 17)
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | Jira 이슈 내부 ID | - |
  | key | string | 이슈 키 (예: PROJ-123) | - |
  | summary | string | 이슈 제목 | - |
  | storyPoints | number? | Story Points (`customfield_10016`); 투표 완료 후 여기에 결과 기록 예정 | - |
  | description | string \| null? | 이슈 설명. Cloud는 ADF → 평문 변환, Server·DC는 평문/HTML 그대로 | - |
  | assignee | `{ displayName: string; avatarUrl?: string }` \| null? | 담당자 정보 | - |
  | reporter | `{ displayName: string; avatarUrl?: string }` \| null? | 보고자 정보 | - |
  | dueDate | string \| null? | 마감일 (ISO 날짜 문자열) | - |
  | priority | `{ name: string; iconUrl?: string }` \| null? | 우선순위 | - |
- **관계**: `usePokerStore.tickets[]`에 배열로 보관. `currentTicketIndex`로 현재 투표 대상 티켓을 가리킨다. 투표 완료 후 `CompletedTicket.ticket` 필드로 이동하여 결과와 함께 기록된다.

---

## JiraEpic (로컬 인터페이스)
- **설명**: Epic 검색 결과로 반환되는 에픽 단건 표현. `CreateRoomWizard` 내부에서만 사용되는 임시 인터페이스.
- **코드 위치**: `components/poker/CreateRoomWizard.tsx` (line 9)
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | Jira 에픽 내부 ID | - |
  | key | string | 에픽 키 (예: PROJ-42) | - |
  | summary | string | 에픽 제목 | - |
- **관계**: `foundEpic` 로컬 state로만 보관되며 방 생성 시 외부로 전달되지 않는다. 하위 이슈 조회의 `epicKey` 인자로만 활용된다.
