# Jira 연동 (jira-integration) 도메인
> 최종 갱신: 2026-03-28

## 개요
Jira Cloud 및 Server·DC 인스턴스에 인증하고, 지정한 Epic의 하위 이슈 목록을 가져와 Planning Poker 세션의 티켓 데이터로 공급하는 도메인이다. Next.js API Route가 브라우저와 Jira REST API 사이의 프록시 역할을 수행하여 토큰을 클라이언트에 직접 노출하지 않는다.

## 앱 구성
- **poker**: Jira 인증 검증 UI(Step 1), Epic 검색 및 이슈 목록 조회 UI(Step 3)를 포함한 방 생성 위저드(`CreateRoomWizard`)와, 이를 처리하는 서버 프록시 API(`/api/jira`)로 구성됨

## 핵심 엔티티
- JiraConfig
- JiraTicket
- JiraEpic (로컬 인터페이스, 위저드 내부)

## 외부 도메인 연관
- → 영향을 주는 도메인: poker-room (Epic 검색 완료 후 `createRoom(jiraConfig, tickets)` 호출로 방 생성 트리거; JiraConfig·JiraTicket 타입을 스토어로 전달)
- ← 영향을 받는 도메인: [교차 분석 시 보완]
