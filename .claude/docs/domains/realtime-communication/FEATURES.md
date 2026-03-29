# 실시간 통신 도메인 - 기능 목록
> 최종 갱신: 2026-03-28

---

## poker.sse_connection
- **설명**: 클라이언트가 SSE 채널을 열어 방에 입장한다. 입장 시 기존 피어 목록(room_state)을 수신하고, 기존 피어들에게 신규 피어 도착(peer_joined)을 브로드캐스트한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (EventSource 생성, room_state / peer_joined 이벤트 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (GET 핸들러), `lib/signalingStore.ts` (addPeer, getExistingPeers, broadcast)
  - API: `GET /api/signaling/[roomId]?peerId={peerId}&name={name}`
- **주요 엔티티**: PeerEntry, PeerConn
- **영향을 줌 (impacts)**:
  - `poker.webrtc_negotiation` — 피어 목록 수신 후 SDP 교환 시작
    - 트리거: room_state 이벤트 수신 시 기존 피어마다 createPeerConnection 호출
    - 영향 범위: RTCPeerConnection 생성 및 offer/answer 교환
  - `poker.방_입장_참가자` — onPeerConnected 콜백으로 포커 게임에 참가자 추가
    - 트리거: peer_joined SSE 이벤트 수신
    - 영향 범위: addParticipant() 호출 → participants[] 갱신
  - `poker.호스트_재접속` — 새 피어 연결 시 이름 매칭으로 호스트 복원 트리거
    - 트리거: onPeerConnected에서 departedHostName과 일치
    - 영향 범위: migrateHost() + host_migrated broadcast
- **영향을 받음 (affected_by)**:
  - (없음 — SSE 연결은 클라이언트 진입 시 독립적으로 시작)
- **변경 시 체크리스트**:
  - [ ] SSE 헤더(`Content-Type: text/event-stream`, `Cache-Control: no-cache`) 유지 여부 확인
  - [ ] peerId / name 쿼리 파라미터 누락 시 400 응답 확인
  - [ ] room_state 이벤트 데이터 구조 변경 시 FE 파서(`peers: [{id, name}]`) 동시 수정
  - [ ] heartbeat 주기 변경 시 클라이언트 타임아웃 설정과 정합성 확인

---

## poker.webrtc_negotiation
- **설명**: SSE 채널을 시그널링 경로로 활용해 WebRTC Offer / Answer / ICE candidate를 교환하고 P2P DataChannel을 개설한다. ICE candidate는 100ms 윈도우로 묶어 배치 전송하며, remoteDescription 설정 전 수신된 candidate는 버퍼링 후 일괄 적용한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (createPeerConnection, setupDataChannel, offer / answer / ice_candidates 이벤트 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (POST 릴레이 경유), `lib/signalingStore.ts` (sendToPeer)
  - API: `POST /api/signaling/[roomId]` (type: offer | answer | ice_candidates)
- **주요 엔티티**: PeerConn, TransportMode
- **영향을 줌 (impacts)**:
  - `poker.game_message_broadcast` — DataChannel 개설 → P2P 메시지 전송 가능
    - 트리거: DataChannel open 이벤트
    - 영향 범위: broadcast/sendToPeer 함수가 P2P 경로로 동작
  - `poker.relay_fallback` — P2P 연결 실패 시 폴백 트리거
    - 트리거: 8초(RELAY_FALLBACK_TIMEOUT) 내 DataChannel 미개설
    - 영향 범위: TransportMode 'connecting' → 'relay' 전환
- **영향을 받음 (affected_by)**:
  - `poker.sse_connection` — room_state에서 피어 목록 수신 후 시작
    - 의존 필드: peers[].id, peers[].name
- **변경 시 체크리스트**:
  - [ ] RTC_CONFIG iceServers 변경 시 STUN/TURN 서버 가용성 별도 검증
  - [ ] DataChannel 이름('game') 변경 시 ondatachannel 수신 측 동시 수정
  - [ ] ICE candidate 배치 타이밍(100ms) 조정 시 고지연 환경 재검증
  - [ ] remoteDescriptionSet 버퍼링 로직 수정 시 race condition 재확인

---

## poker.relay_fallback
- **설명**: WebRTC P2P DataChannel이 8초(RELAY_FALLBACK_TIMEOUT) 내 열리지 않으면 서버 릴레이 모드로 자동 전환한다. 이후 모든 DataMessage를 SSE 서버가 중계하며, 기존 RTCPeerConnection은 정리된다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (scheduleRelayFallback, activateRelayMode, sendRelay, relay 이벤트 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (POST type=relay 수신 → broadcast / sendToPeer), `lib/signalingStore.ts` (broadcast, sendToPeer)
  - API: `POST /api/signaling/[roomId]` (type: relay, payload: { msg: DataMessage })
- **주요 엔티티**: TransportMode, DataMessage, PeerConn
- **영향을 줌 (impacts)**:
  - `poker.game_message_broadcast` — 릴레이 모드로 전환 → 서버 경유 전송
    - 트리거: activateRelayMode() 호출
    - 영향 범위: TransportMode 'relay', broadcast/sendToPeer가 서버 POST 경유
- **영향을 받음 (affected_by)**:
  - `poker.webrtc_negotiation` — P2P 연결 8초 타임아웃 시 트리거
    - 의존 필드: relayFallbackTimer, 피어 연결 상태
- **변경 시 체크리스트**:
  - [ ] RELAY_FALLBACK_TIMEOUT 값 변경 시 사용자 경험(대기 시간) 영향 검토
  - [ ] relay 모드 전환 시 isInitiator 플래그 기반 sync_request 중복 전송 방지 로직 확인
  - [ ] 릴레이 모드 진입 후 peer_joined(room_state) 재수신 시 중복 onPeerConnected 방지 확인

---

## poker.peer_disconnect
- **설명**: 피어 연결 해제를 두 경로로 감지한다. (1) SSE request.signal abort 이벤트 — 브라우저 종료·네트워크 끊김 감지. (2) sendBeacon POST(type=leave) — beforeunload 시 자발적 퇴장 신호. removePeer가 boolean을 반환해 중복 peer_left 브로드캐스트를 방지한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (peer_left SSE 핸들러, cleanup 함수), `app/room/[roomId]/page.tsx` (sendBeacon beforeunload)
  - BE: `app/api/signaling/[roomId]/route.ts` (abort 핸들러, POST type=leave 처리), `lib/signalingStore.ts` (removePeer)
  - API: `POST /api/signaling/[roomId]` (type: leave, body: { from: peerId })
- **주요 엔티티**: PeerEntry, PeerConn
- **영향을 줌 (impacts)**:
  - `poker.호스트_재접속` — 호스트 SSE 끊김 감지 → 대기 오버레이 표시
    - 트리거: onPeerDisconnected에서 해당 피어가 hostId와 일치
    - 영향 범위: hostWaiting state, departedHostName 설정
  - `poker.방_종료_및_이탈` — peer_left → removeParticipant()
    - 트리거: peer_left SSE 이벤트 수신
    - 영향 범위: participants[] 갱신
- **영향을 받음 (affected_by)**:
  - `poker.방_종료_및_이탈` — sendBeacon POST로 peer_left 트리거
    - 의존 필드: peerId (beforeunload에서 전송)
  - `poker.참가자_추방` — kick 대상 퇴장 → SSE 정리
    - 의존 필드: targetId
- **변경 시 체크리스트**:
  - [ ] removePeer 중복 방지 로직(boolean 반환) 수정 시 peer_left 이중 발송 가능성 재검토
  - [ ] rooms Map에서 마지막 피어 제거 시 방 자체도 삭제되는 동작 확인(roomExists 영향)
  - [ ] sendBeacon 페이로드 변경 시 POST 핸들러 파싱 로직 동시 수정

---

## poker.room_existence_check
- **설명**: 방 입장 전 유효성을 확인한다. signalingStore.roomExists()를 기반으로 방 존재 여부를 JSON으로 반환하며, 클라이언트는 이 응답으로 잘못된 roomId 접근을 차단한다.
- **코드 위치**:
  - FE: `app/room/[roomId]/page.tsx` (GET 호출, roomValid 상태)
  - BE: `app/api/room/[roomId]/route.ts`, `lib/signalingStore.ts` (roomExists)
  - API: `GET /api/room/[roomId]`
- **주요 엔티티**: PeerEntry (rooms Map 존재 여부 기준)
- **영향을 줌 (impacts)**:
  - `poker.방_유효성_검사` — 방 존재 여부 반환 → JoinRoomForm 표시 여부 결정
    - 트리거: GET /api/room/[roomId] 응답
    - 영향 범위: roomValid state → UI 분기 (찾을 수 없음 / JoinRoomForm)
- **영향을 받음 (affected_by)**:
  - `poker.peer_disconnect` — 마지막 피어 제거 시 roomExists() false
    - 의존 필드: rooms Map 내 해당 roomId 키 존재 여부
- **변경 시 체크리스트**:
  - [ ] roomExists 판단 기준(rooms Map 존재 여부)이 실제 활성 방과 일치하는지 확인
  - [ ] 응답 스키마 `{ exists: boolean }` 변경 시 FE 파싱 로직 동시 수정
  - [ ] SSE 연결이 없어도 방이 생성되는 경우가 없는지(addPeer 호출 순서) 확인

---

## poker.game_message_broadcast
- **설명**: 게임 상태 변경 메시지(voted / reveal / reset / next / sync_request / sync_response / room_closed / kick / host_migrated / leaving)를 전체 또는 특정 피어에게 전송한다. P2P DataChannel이 열려 있으면 직접 전송하고, 릴레이 모드에서는 서버를 경유한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (broadcast, sendToPeer 함수 반환 — 호출 측은 `app/room/[roomId]/page.tsx`)
  - BE: `app/api/signaling/[roomId]/route.ts` (POST 릴레이 중계), `lib/signalingStore.ts` (broadcast, sendToPeer)
  - API: `POST /api/signaling/[roomId]` (type: relay)
- **주요 엔티티**: DataMessage, TransportMode
- **영향을 줌 (impacts)**:
  - `poker.카드_선택` — voted 메시지 → setParticipantVoted()
    - 트리거: 원격 참가자 카드 선택 시
    - 영향 범위: 해당 Participant.hasVoted = true
  - `poker.투표_공개` — reveal 메시지 → setParticipantVote()
    - 트리거: 원격 참가자 투표 공개 시
    - 영향 범위: 해당 Participant.vote 설정
  - `poker.재투표` — reset 메시지 → resetRound()
    - 트리거: 호스트 Re-vote 클릭
    - 영향 범위: 전체 참가자 투표 상태 초기화
  - `poker.다음_티켓` — next 메시지 → nextTicket()
    - 트리거: 호스트 Next 클릭
    - 영향 범위: currentTicketIndex++, 투표 상태 초기화
  - `poker.참가자_추방` — kick 메시지 → 대상 퇴장 처리
    - 트리거: 호스트 kick 버튼 클릭
    - 영향 범위: targetId 참가자 세션 정리
  - `poker.방_종료_및_이탈` — room_closed/leaving 메시지 → leaveRoom()
    - 트리거: 호스트 방 종료 또는 참가자 이탈
    - 영향 범위: 전체 참가자 세션 정리
  - `poker.호스트_재접속` — host_migrated 메시지 → migrateHost()
    - 트리거: 호스트 재접속 후 이름 매칭 성공
    - 영향 범위: hostId 갱신
- **영향을 받음 (affected_by)**:
  - `poker.webrtc_negotiation` — DataChannel 개설로 P2P 전송 경로 확보
    - 의존 필드: DataChannel.readyState === 'open'
  - `poker.relay_fallback` — 릴레이 모드 전환으로 서버 경유 전송 경로 확보
    - 의존 필드: relayModeRef.current
- **변경 시 체크리스트**:
  - [ ] DataMessage에 새 type 추가 시 onMessage 핸들러(poker-game 도메인 page.tsx) 동시 구현
  - [ ] broadcast vs sendToPeer 사용 구분 — 전체 전달 필요 메시지에 sendToPeer 오용 방지
  - [ ] 릴레이 모드에서 채널이 열린 피어와의 혼용 전송이 없는지 확인(relayModeRef 분기)
  - [ ] sync_response의 SyncState 구조 변경 시 usePokerStore.applySyncState와 동시 수정
