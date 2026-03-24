# Jira 연동 도메인 - 엔티티 정의

> 최종 갱신: 2026-03-25

## JiraConfig

- **설명**: Jira 인증 정보를 담는 설정 객체. Cloud는 email+token(Basic auth), Server·DC는 token만(Bearer PAT) 사용
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | domain | string | Jira 인스턴스 도메인 또는 Base URL | - |
  | token | string | API Token (Cloud) 또는 Personal Access Token (Server·DC) | - |
  | email | string (optional) | Jira 계정 이메일 — Cloud 전용, 존재 여부로 Cloud/Server 분기 결정 | - |
- **상태 전이**: 없음
- **관계**:
  - JiraConfig → PokerState: `usePokerStore.createRoom` 호출 시 jiraConfig 필드에 저장되어 세션 전체에서 사용 (1:1)

---

## JiraTicket

- **설명**: Jira 이슈 한 건을 나타내는 전송 객체. Epic 하위의 Story/Task/Bug 이슈가 대상이며, Planning Poker의 추정 단위가 됨
- **코드 위치**: `store/usePokerStore.ts`
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | Jira 이슈 내부 ID | - |
  | key | string | Jira 이슈 키 (예: PROJ-123) | - |
  | summary | string | 이슈 제목 | - |
  | storyPoints | number (optional) | Story Points — Jira customfield_10016 | poker |
  | description | string \| null (optional) | 이슈 설명 — Cloud는 ADF → 평문 변환, Server는 원문 | - |
  | assignee | object \| null (optional) | 담당자 (displayName, avatarUrl) | - |
  | reporter | object \| null (optional) | 보고자 (displayName, avatarUrl) | - |
  | dueDate | string \| null (optional) | 마감일 | - |
  | priority | object \| null (optional) | 우선순위 (name, iconUrl) | - |
- **상태 전이**: 없음 (읽기 전용 스냅샷 — 투표 결과는 CompletedTicket에 별도 기록됨)
- **관계**:
  - JiraTicket → PokerState.tickets: 세션 생성 시 배열로 저장되어 currentTicketIndex로 순차 진행 (1:N)
  - JiraTicket → CompletedTicket: 투표 완료 후 CompletedTicket.ticket 필드로 포함 (1:1)

---

## JiraEpic

- **설명**: Jira Epic 조회 응답을 나타내는 로컬 인터페이스. CreateRoomWizard Step 3에서 Epic 유효성 확인 결과를 표시하는 용도
- **코드 위치**: `components/poker/CreateRoomWizard.tsx` (로컬 인터페이스 정의)
- **주요 필드**:
  | 필드명 | 타입 | 설명 | 참조 도메인 |
  |---|---|---|---|
  | id | string | Jira Epic 내부 ID | - |
  | key | string | Jira Epic 키 (예: PROJ-10) | - |
  | summary | string | Epic 제목 | - |
- **상태 전이**: 없음
- **관계**:
  - JiraEpic → JiraTicket: Epic 확인 후 해당 Epic의 하위 이슈를 JiraTicket 배열로 별도 조회 (1:N)
