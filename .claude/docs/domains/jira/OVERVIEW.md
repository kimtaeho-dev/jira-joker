# Jira 연동 (jira) 도메인

> 최종 갱신: 2026-03-25

## 개요

Jira REST API와의 연동을 담당하는 도메인. 인증 정보를 클라이언트에서 헤더로 전달받아 서버 측 프록시를 통해 Jira Cloud(Basic auth) 및 Server·DC(Bearer PAT) 양쪽 환경을 지원하며, Epic 조회와 하위 이슈 목록 조회 결과를 Planning Poker 세션 생성의 입력으로 제공한다.

## 앱 구성

- **app (Next.js)**: `/api/jira` 프록시 라우트 — 인증 헤더를 Jira API로 전달하고 응답을 정규화하여 반환
- **FE (CreateRoomWizard)**: 3단계 방 생성 마법사 내에서 Jira 인증 검증, Epic 검색, 이슈 목록 로드를 순차 수행

## 핵심 엔티티

- JiraConfig — 상세는 ENTITIES.md 참조
- JiraTicket — 상세는 ENTITIES.md 참조
- JiraEpic — 상세는 ENTITIES.md 참조

## 외부 도메인 연관

- → 영향을 주는 도메인: **poker** — 조회된 JiraTicket 목록과 JiraConfig가 `createRoom` 액션의 입력이 되어 포커 세션 초기 상태를 구성
- ← 영향을 받는 도메인: 없음 (jira 도메인은 외부 도메인의 상태 변경에 의해 동작이 달라지지 않음)
