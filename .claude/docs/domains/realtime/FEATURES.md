# 실시간 통신 도메인 - 기능 목록

> 최종 갱신: 2026-03-25

---

## realtime.SSE_시그널링_연결

- **설명**: 클라이언트가 `/api/signaling/[roomId]` SSE 엔드포인트에 연결하여 기존 피어 목록을 수신하고, 이후 신규 피어 진입/퇴장/시그널 이벤트를 실시간으로 수신한다. 연결 성립 시 서버는 addPeer로 피어를 등록하고 15초 heartbeat를 시작한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (useEffect 내 EventSource 생성, room_state/peer_joined/peer_left/offer/answer/ice_candidates/relay 이벤트 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (GET handler)
  - API: `GET /api/signaling/[roomId]?peerId=&name=`
- **주요 엔티티**: PeerEntry, PeerConn, TransportMode
- **영향을 줌 (impacts)**:
  - `realtime.WebRTC_P2P_협상` — room_state/peer_joined 수신 시 createPeerConnection 호출로 P2P 협상을 트리거한다
    - 트리거: room_state 이벤트 수신 (기존 피어 존재 시) 또는 peer_joined 이벤트 수신
    - 영향 범위: peersRef에 PeerConn 엔트리 생성 + offer SDP 전송 시작
  - `realtime.서버_릴레이_폴백` — room_state/peer_joined 수신 시 scheduleRelayFallback 호출로 8초 타임아웃 타이머를 시작한다
    - 트리거: 피어가 1명 이상 존재하는 room_state 또는 peer_joined 수신
    - 영향 범위: RELAY_FALLBACK_TIMEOUT(8초) 후 열린 DataChannel 없으면 릴레이 모드 전환
  - `realtime.피어_이탈_처리` — SSE 연결 abort 시 removePeer + peer_left broadcast 수행
    - 트리거: request.signal abort 이벤트 (탭 닫기, 네트워크 단절 등)
    - 영향 범위: signalingStore에서 피어 제거, 나머지 피어에게 peer_left SSE 전송
  - `room.방_유효성_검사` — SSE 연결 시 signalingStore rooms Map에 roomId가 등록되어 roomExists() 결과에 영향
    - 트리거: addPeer 호출 시 rooms Map에 roomId key 생성
    - 영향 범위: GET /api/room/[roomId]가 { exists: true } 반환
  - `room.대기_화면` — onPeerConnected 콜백으로 participants 증가하여 대기 화면 탈출 조건 충족
    - 트리거: DataChannel open 성공 + connectedPeersRef에 추가 시
    - 영향 범위: addParticipant 호출로 participants.length 변화
- **영향을 받음 (affected_by)**:
  - `poker.방_생성_위저드` — createRoom 완료 후 roomId+myName 설정 → useWebRTC enabled=true로 SSE 연결 활성화
    - 의존 필드: PokerState.roomId, PokerState.myName
  - `room.방_참가` — joinRoom 완료 후 myName 설정 → useWebRTC enabled=true로 SSE 연결 활성화
    - 의존 필드: PokerState.roomId, PokerState.myName
- **변경 시 체크리스트**:
  - [ ] GET 엔드포인트 URL 변경 시 → FE EventSource URL, CLAUDE.md Architecture 섹션 동시 수정 필요
  - [ ] heartbeat 간격 변경 시 → 클라이언트 SSE 타임아웃 설정과 정합성 확인
  - [ ] room_state/peer_joined 이벤트 데이터 구조 변경 시 → FE 이벤트 핸들러 파싱 로직 수정 필요

---

## realtime.WebRTC_P2P_협상

- **설명**: Initiator(신규 피어)가 RTCPeerConnection을 생성하고 SDP offer를 전송하면, 기존 피어가 answer를 반환하는 WebRTC 핸드셰이크를 수행한다. ICE candidate는 100ms 윈도우로 배치 전송하며, setRemoteDescription 완료 전 수신된 candidate는 pendingCandidates 버퍼에 보관 후 일괄 적용한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (createPeerConnection, setupDataChannel, offer/answer/ice_candidates 이벤트 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (POST handler — offer/answer/ice_candidates를 지정 피어에게 relay)
  - API: `POST /api/signaling/[roomId]`
- **주요 엔티티**: PeerConn, TransportMode
- **영향을 줌 (impacts)**:
  - `realtime.DataChannel_메시지_전송` — DataChannel onopen 시 TransportMode를 'p2p'로 설정하고 sync_request 전송으로 상태 동기화를 시작한다
    - 트리거: RTCDataChannel onopen 이벤트 (WebRTC 연결 성공)
    - 영향 범위: broadcast/sendToPeer가 DataChannel 경로를 사용하게 됨; poker 도메인 상태 동기화 시작
  - `realtime.서버_릴레이_폴백` — DataChannel open 성공 시 릴레이 폴백 타이머를 취소한다
    - 트리거: DataChannel onopen 이벤트
    - 영향 범위: relayFallbackTimerRef 클리어, 릴레이 모드 전환 방지
- **영향을 받음 (affected_by)**:
  - `realtime.SSE_시그널링_연결` — room_state/peer_joined SSE 이벤트 수신 시 createPeerConnection 호출로 시작됨
    - 의존 필드: room_state.peers[], peer_joined.peerId/name
- **변경 시 체크리스트**:
  - [ ] SDP offer/answer 시그널 타입명 변경 시 → FE 이벤트 핸들러와 sendSignal 호출 타입 동시 수정
  - [ ] ICE candidate 배치 윈도우(100ms) 변경 시 → 시그널링 왕복 횟수와 연결 속도 트레이드오프 재검토
  - [ ] RTC_CONFIG(STUN 서버) 변경 시 → 방화벽 환경 fallback 커버리지 확인

---

## realtime.서버_릴레이_폴백

- **설명**: 첫 피어 발견 후 8초(RELAY_FALLBACK_TIMEOUT) 이내 DataChannel이 하나도 열리지 않으면 서버 릴레이 모드로 자동 전환한다. 릴레이 모드에서는 `POST /api/signaling/[roomId]` (type: relay)로 메시지를 전송하고, SSE relay 이벤트로 수신한다. broadcast/sendToPeer 호출측 코드 변경 없이 투명하게 동작한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (activateRelayMode, scheduleRelayFallback, sendRelay, relay SSE 이벤트 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (POST type=relay → broadcast SSE relay 이벤트)
  - API: `POST /api/signaling/[roomId]` (body: { from, to?, type: 'relay', payload: { msg } })
- **주요 엔티티**: TransportMode, PeerConn, DataMessage
- **영향을 줌 (impacts)**:
  - `realtime.DataChannel_메시지_전송` — 릴레이 모드 활성화 시 broadcast/sendToPeer가 sendRelay 경로를 사용하도록 전환된다
    - 트리거: activateRelayMode() 호출 (8초 타임아웃 또는 명시적 활성화)
    - 영향 범위: relayModeRef=true 설정; 이후 모든 메시지 전송이 서버 경유
- **영향을 받음 (affected_by)**:
  - `realtime.SSE_시그널링_연결` — room_state/peer_joined 수신 시 scheduleRelayFallback 호출로 타이머 시작
    - 의존 필드: peers 배열 크기(피어 존재 여부)
  - `realtime.WebRTC_P2P_협상` — DataChannel open 성공 시 타이머 취소
    - 의존 필드: DataChannel.readyState === 'open'
- **변경 시 체크리스트**:
  - [ ] RELAY_FALLBACK_TIMEOUT(8초) 변경 시 → 사용자 경험(연결 지연 허용치)과 WebRTC 성공률 재검토
  - [ ] relay POST 페이로드 구조 변경 시 → BE relay 핸들러와 FE sendRelay/relay 이벤트 파싱 동시 수정
  - [ ] 릴레이 모드 전환 시 기존 PeerConnection cleanup 로직 → pc.close() 호출 여부 확인

---

## realtime.피어_이탈_처리

- **설명**: 피어가 능동적으로 나가기(POST type=leave via sendBeacon) 또는 비자발적으로 연결이 끊길 때(SSE abort, iceConnectionState failed) 피어를 signalingStore에서 제거하고 나머지 피어에게 peer_left SSE를 브로드캐스트한다. 클라이언트는 peer_left 이벤트 수신 시 onPeerDisconnected 콜백을 실행한다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (peer_left SSE 이벤트 핸들러, oniceconnectionstatechange/onconnectionstatechange 핸들러)
  - BE: `app/api/signaling/[roomId]/route.ts` (POST type=leave + request.signal abort → removePeer + broadcast peer_left)
  - API: `POST /api/signaling/[roomId]` (body: { from, type: 'leave' })
- **주요 엔티티**: PeerEntry, PeerConn
- **영향을 줌 (impacts)**:
  - `room.호스트_재접속_보호` — onPeerDisconnected 콜백에서 peerId === hostId일 때 호스트 이탈 감지 → 대기 오버레이 표시
    - 트리거: peer_left SSE 수신 또는 ICE failed 감지
    - 영향 범위: hostWaiting=true 설정, 전체 화면 오버레이 렌더링
  - `poker.투표` — onPeerDisconnected 콜백으로 removeParticipant 호출 → 참가자 수 변화로 allVoted 조건 재계산
    - 트리거: peer_left SSE 수신 시 onPeerDisconnected(peerId) 콜백
    - 영향 범위: participants 배열 축소, 투표 완료 판정 변경 가능
- **영향을 받음 (affected_by)**:
  - `realtime.SSE_시그널링_연결` — SSE 연결 abort(탭 닫기, 네트워크 단절) 시 서버 측 이탈 처리 시작
    - 의존 필드: request.signal abort 이벤트
  - `room.beforeunload_이탈` — sendBeacon POST type=leave + DataChannel leaving 메시지를 함께 전송하여 이 기능의 서버/클라이언트 이탈 경로를 동시 트리거
    - 의존 필드: myId, roomId (sendBeacon body)
- **변경 시 체크리스트**:
  - [ ] removePeer 반환값(boolean) 활용 — 중복 peer_left 브로드캐스트 방지 로직 유지 확인
  - [ ] iceConnectionState 'failed' 처리 경로와 peer_left SSE 경로 중복 처리 여부 확인 (현재 peer_left SSE에서도 처리하므로 중복 onPeerDisconnected 가능성 점검)
  - [ ] sendBeacon 지원 브라우저 범위 확인 (탭 닫기 시 leave 전달 신뢰도)

---

## realtime.DataChannel_메시지_전송

- **설명**: WebRTC DataChannel(P2P) 또는 서버 릴레이 경로로 게임 메시지(DataMessage)를 전체 피어에게 broadcast하거나 특정 피어에게 sendToPeer한다. relayModeRef 값에 따라 전송 경로가 자동 분기되며 호출측 코드는 동일하다.
- **코드 위치**:
  - FE: `hooks/useWebRTC.ts` (broadcast, sendToPeer 함수; DataMessage 타입 정의)
- **주요 엔티티**: DataMessage, PeerConn, TransportMode
- **영향을 줌 (impacts)**:
  - `poker.투표` — voted/reveal/reset/next 메시지가 handleDataMessage를 통해 PokerState를 갱신한다
    - 트리거: DataChannel onmessage 또는 SSE relay 이벤트 수신
    - 영향 범위: Participant.hasVoted, Participant.vote, phase, currentTicketIndex 등 Zustand 상태 업데이트
  - `poker.상태_동기화` — sync_request/sync_response 메시지가 SyncState 전달 흐름을 구동한다
    - 트리거: DataChannel open 후 sync_request 자동 발행 (isInitiator=true)
    - 영향 범위: 신규 피어의 전체 게임 상태 초기화
  - `room.이탈_호스트` — room_closed 메시지 수신 시 방 종료 오버레이 표시
    - 트리거: room_closed DataMessage 수신
    - 영향 범위: disconnectReason='host_left'
  - `room.참가자_추방` — kick 메시지 수신 시 대상 추방/나머지 목록 갱신
    - 트리거: kick DataMessage 수신
    - 영향 범위: 대상은 disconnectReason='kicked', 나머지는 removeParticipant
- **영향을 받음 (affected_by)**:
  - `realtime.WebRTC_P2P_협상` — DataChannel open 후 P2P 경로가 활성화된다
    - 의존 필드: PeerConn.channel.readyState === 'open'
  - `realtime.서버_릴레이_폴백` — 릴레이 모드 전환 후 서버 경유 경로가 활성화된다
    - 의존 필드: relayModeRef.current === true
- **변경 시 체크리스트**:
  - [ ] DataMessage 타입에 새 메시지 타입 추가 시 → handleDataMessage(app/room/[roomId]/page.tsx) 핸들러에 해당 type 처리 로직 추가 확인
  - [ ] broadcast vs sendToPeer 사용 구분 → kick은 전체 broadcast(대상+나머지 모두 처리), sync_response는 sendToPeer
  - [ ] 릴레이 모드에서 to 미지정 시 서버 broadcast → 타겟 지정(to) 릴레이 경로 정합성 확인
