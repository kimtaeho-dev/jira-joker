# 전체 용어집

> 최종 갱신: 2026-03-25
> 도메인별 상세: .claude/docs/business/domains/{domain}/GLOSSARY.md

## A

### ADF (Atlassian Document Format)
- **정의**: Jira Cloud API v3가 사용하는 구조화된 문서 형식. description 필드가 JSON 트리로 반환되며 평문 변환이 필요함
- **소속 도메인**: jira
- **유사어·혼동 주의**: Server/DC API는 plain text/HTML로 반환하므로 ADF 파싱 불필요

### allVoted (전원 투표 완료)
- **정의**: 현재 라운드에서 참가자 2인 이상이 전원 투표를 완료한 상태 (phase='voting' + participants.length >= 2 + 전원 hasVoted=true)
- **소속 도메인**: poker
- **유사어·혼동 주의**: hasVoted는 개인 투표 여부, allVoted는 전체 완료 판정

### authMode (인증 모드)
- **정의**: Jira 연결 방식 선택값. cloud=Jira Cloud(Basic auth + API v3), server=Jira Server·DC(Bearer PAT + API v2)
- **소속 도메인**: jira, poker

### Average (평균)
- **정의**: 공개된 투표 값 중 숫자로 변환 가능한 값들의 산술 평균. '?', '☕'는 제외
- **소속 도메인**: poker

## C

### CARD_VALUES (카드 값 목록)
- **정의**: Planning Poker에서 사용 가능한 9종 카드 값 고정 배열: 1, 2, 3, 5, 8, 13, 21, ?, ☕
- **소속 도메인**: poker

### CompletedTicket (완료된 티켓)
- **정의**: 투표 라운드가 끝나 결과(Mode, Average, 전체 투표값)가 확정된 티켓. nextTicket 호출 시 생성되며 이후 불변
- **소속 도메인**: poker

### customfield_10016 (스토리 포인트 필드)
- **정의**: Jira Cloud에서 Story Points를 저장하는 커스텀 필드 ID. 하드코딩됨
- **소속 도메인**: jira, poker

## D

### DataChannel
- **정의**: WebRTC P2P 연결 위에서 텍스트 데이터를 교환하는 채널. 'game' 이름으로 생성되며 게임 메시지(DataMessage) 전송에 사용
- **소속 도메인**: realtime

### DataMessage (데이터 메시지)
- **정의**: WebRTC DataChannel 또는 서버 릴레이로 피어 간 교환하는 실시간 이벤트 메시지. 10가지 타입: voted, reveal, reset, next, sync_request, sync_response, room_closed, kick, host_migrated, leaving
- **소속 도메인**: realtime, poker, room

### departedHostName (이탈 호스트 이름)
- **정의**: 연결이 끊어진 호스트의 닉네임. 재접속 판별 시 이름 매칭에 사용되는 임시 상태
- **소속 도메인**: room

### disconnectReason (연결 해제 사유)
- **정의**: 참가자가 강제로 방에서 나가게 된 이유. 'host_left'(호스트 종료), 'kicked'(추방), null(정상 상태)
- **소속 도메인**: room

## E

### Epic (에픽)
- **정의**: Planning Poker 세션의 대상 단위. 특정 Epic 하위 이슈(Story/Task/Bug)를 일괄 추정
- **소속 도메인**: jira, poker
- **유사어·혼동 주의**: Jira에서 hierarchyLevel=1 또는 issuetype.name이 'epic'/'에픽'/'큰틀'인 이슈

### epicKey (에픽 키)
- **정의**: Jira Epic 이슈의 고유 키 (예: PROJ-42). Planning Poker 세션의 티켓 범위를 결정하는 출발점
- **소속 도메인**: jira

## H

### hasVoted (투표 완료 여부)
- **정의**: 한 참가자가 현재 라운드에서 카드를 선택했는지 여부. 카드 값은 포함하지 않음
- **소속 도메인**: poker
- **유사어·혼동 주의**: allVoted와 구분 — hasVoted는 개인, allVoted는 전체

### heartbeat (하트비트)
- **정의**: 서버가 15초마다 SSE 스트림으로 전송하는 keep-alive 신호. 응답 없는 dead connection을 감지하고 조기 해제
- **소속 도메인**: realtime

### host (호스트)
- **정의**: 방을 생성한 참가자. 방 종료, 참가자 추방, 투표 결과 확정 등 관리 권한 보유. hostId로 식별
- **소속 도메인**: room, poker
- **유사어·혼동 주의**: 서버에 hostId 개념 없음 — 클라이언트(Zustand) 전용

### hostWaiting (호스트 대기)
- **정의**: 호스트가 비자발적으로 연결을 끊었을 때 참가자 측에서 재접속을 기다리는 상태. true이면 대기 오버레이 표시
- **소속 도메인**: room

## I

### ICE candidate (ICE 후보)
- **정의**: WebRTC 연결 경로 후보 (IP+포트). STUN 서버로 발견한 퍼블릭 주소를 상대방에게 전달
- **소속 도메인**: realtime

### Initiator (이니시에이터)
- **정의**: 새로 방에 참가하는 피어. offer 생성 + DataChannel 생성 + sync_request 전송 담당
- **소속 도메인**: realtime

## J

### JiraConfig (Jira 설정)
- **정의**: Jira API 호출에 필요한 인증 정보 묶음 (domain, token, email). 보안상 SyncState에서 제외
- **소속 도메인**: jira, poker

### JiraTicket (Jira 티켓)
- **정의**: 투표 대상 Jira 이슈 1건. key, summary, description, storyPoints 등 포함. 방 생성 시 로드 후 불변
- **소속 도메인**: jira, poker

## M

### Mesh Network (풀 메시 네트워크)
- **정의**: 모든 참가자가 서로 1:1 RTCPeerConnection을 맺는 토폴로지. N명 참가 시 N*(N-1)/2개 연결
- **소속 도메인**: realtime

### Mode (최빈값)
- **정의**: 공개된 투표 값 중 가장 많이 선택된 카드 값. 동점 시 먼저 집계된 값
- **소속 도메인**: poker

## P

### PAT (Personal Access Token)
- **정의**: Jira Server/Data Center에서 Bearer 인증에 사용하는 개인 액세스 토큰. Cloud의 API Token과 구분
- **소속 도메인**: jira

### Participant (참가자)
- **정의**: 방에 연결된 사용자 (호스트 포함). id, name, hasVoted, vote 필드 보유
- **소속 도메인**: poker, room

### pendingCandidates (ICE 버퍼)
- **정의**: setRemoteDescription 완료 전 수신된 ICE candidate를 임시 보관하는 배열. race condition 방지
- **소속 도메인**: realtime

### phase (투표 단계)
- **정의**: 현재 라운드의 상태. voting=투표 중, revealed=카드 공개됨
- **소속 도메인**: poker

## R

### Relay (릴레이)
- **정의**: 서버가 메시지를 중개하는 전송 모드. WebRTC P2P 실패 시 폴백 경로. 8초 타임아웃 후 자동 전환, 불가역
- **소속 도메인**: realtime, poker

### roomId (방 ID)
- **정의**: 방 생성 시 crypto.randomUUID()로 생성되는 UUID. 초대 링크(/room/[roomId])에 포함
- **소속 도메인**: room, poker

### roomValid (방 유효성)
- **정의**: 방 유효성 검사 결과. null=검증 중(로딩), true=유효, false=무효(방 없음)
- **소속 도메인**: room

## S

### Signaling (시그널링)
- **정의**: WebRTC P2P 연결 수립 전에 SDP offer/answer와 ICE candidate를 교환하는 절차
- **소속 도메인**: realtime

### SSE (Server-Sent Events)
- **정의**: 서버에서 클라이언트로의 단방향 HTTP 스트림. WebRTC 시그널링 이벤트 전달에 사용
- **소속 도메인**: realtime

### SyncState (동기화 상태)
- **정의**: 신규 피어가 합류할 때 기존 피어로부터 받는 전체 게임 상태 스냅샷. JiraConfig는 보안상 제외
- **소속 도메인**: poker

## T

### TransportMode (전송 방식)
- **정의**: WebRTC 연결 현황. connecting→p2p(성공) 또는 connecting→relay(8초 타임아웃). 단방향 전환
- **소속 도메인**: realtime, poker

## 정의 불일치 목록

| 용어 | 도메인 A 정의 | 도메인 B 정의 | 상태 |
|---|---|---|---|
| (없음) | - | - | 정의 불일치 미감지 |
