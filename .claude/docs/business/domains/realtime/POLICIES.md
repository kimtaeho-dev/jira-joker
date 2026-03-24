# 실시간 통신 도메인 - 서비스 정책서

> 최종 갱신: 2026-03-25

---

## realtime.SSE_시그널링_연결

### Validation 규칙

#### POL-001: SSE 연결 파라미터 필수 검증
- **규칙**: SSE 연결 요청에는 반드시 피어 ID(peerId)와 표시 이름(name)이 포함되어야 한다.
- **조건**: GET `/api/signaling/[roomId]` 요청의 쿼리 파라미터에 peerId 또는 name이 없는 경우
- **위반 시**: HTTP 400 응답 반환 ("Missing peerId or name"), SSE 스트림 미생성
- **비즈니스 배경**: 피어를 식별하고 다른 참가자에게 이름을 표시하기 위해 두 값이 모두 필요하다. 정상 앱 흐름에서는 FE가 항상 두 파라미터를 포함하므로 실제 사용자는 이 에러를 접하지 않는다.
- **코드 근거**: `app/api/signaling/[roomId]/route.ts` (GET handler, L23-24)

#### POL-002: SSE 연결 활성화 조건
- **규칙**: roomId, myName이 모두 설정된 상태에서만 SSE 연결을 시작한다.
- **조건**: `useWebRTC` 훅의 `enabled` 옵션이 true일 때만 EventSource를 생성
- **위반 시**: SSE 연결 없음 — 실시간 기능 전체 비활성
- **비즈니스 배경**: 방 생성(createRoom) 또는 방 참가(joinRoom) 완료 전에는 필요한 식별 정보가 없으므로 연결을 지연한다.
- **코드 근거**: `hooks/useWebRTC.ts` (useEffect early return, L285)

#### POL-003: 빈 방 진입 시 P2P 협상 생략
- **규칙**: 방에 아무도 없을 때 첫 번째로 입장하면 WebRTC 연결 협상을 시도하지 않는다.
- **조건**: room_state 이벤트의 peers 배열 길이가 0인 경우
- **위반 시**: 조기 반환, 대기 상태 유지
- **비즈니스 배경**: 혼자 있는 방에서는 연결할 상대가 없으므로 협상 시작이 불필요하다. 이후 다른 피어가 입장하면 peer_joined 이벤트로 협상이 시작된다.
- **코드 근거**: `hooks/useWebRTC.ts` (room_state 핸들러, L296)

#### POL-004: 중복 피어 진입 이벤트 무시
- **규칙**: 이미 연결된 피어에 대한 peer_joined 이벤트는 처리하지 않는다.
- **조건**: peersRef에 이미 해당 peerId가 존재하는 경우
- **위반 시**: 조기 반환, 중복 PeerConnection 생성 방지
- **비즈니스 배경**: 네트워크 지연이나 재연결 시 동일 피어의 peer_joined 이벤트가 중복 수신될 수 있어 방어 처리가 필요하다.
- **코드 근거**: `hooks/useWebRTC.ts` (peer_joined 핸들러, L325)

### 설정값

#### POL-005: SSE Heartbeat 주기
- **설정**: heartbeat 간격 = 15,000ms (15초)
- **비즈니스 의미**: 서버가 15초마다 SSE 스트림에 keep-alive 신호를 전송하여 응답 없는 연결(dead connection)을 빠르게 감지한다. 탭 닫기나 네트워크 단절 시 해당 피어를 빠르게 제거하여 다른 참가자에게 이탈이 반영된다.
- **변경 시 영향**: 값을 줄이면 감지 속도가 빨라지나 서버 부하 증가. 값을 늘리면 이탈 감지가 늦어져 유령 참가자가 오래 목록에 남을 수 있다.
- **코드 근거**: `app/api/signaling/[roomId]/route.ts` (heartbeatInterval, L44)

### 에러 시나리오

#### ERR-001: SSE 연결 파라미터 누락
- **메시지**: "Missing peerId or name"
- **발생 조건**: GET /api/signaling/[roomId] 요청에 peerId 또는 name 쿼리파라미터가 없는 경우
- **사용자 영향**: SSE 연결 실패로 실시간 기능 전체 불가. 정상 앱 흐름에서는 발생하지 않는 내부 오류.
- **대응 방법**: 정상 앱 흐름을 통해 방에 입장하면 자동으로 올바른 파라미터가 포함된다. 직접 URL을 조작한 경우 홈으로 돌아가 다시 시도한다.
- **코드 근거**: `app/api/signaling/[roomId]/route.ts` (GET handler, L23-24)

---

## realtime.WebRTC_P2P_협상

### Validation 규칙

#### POL-006: 릴레이 모드 중 PeerConnection 생성 차단
- **규칙**: 서버 릴레이 모드가 이미 활성화된 상태에서는 새 WebRTC PeerConnection을 생성하지 않는다.
- **조건**: relayModeRef가 true인 경우 createPeerConnection 즉시 반환
- **위반 시**: PeerConnection 생성 없음, 릴레이 경로 유지
- **비즈니스 배경**: 릴레이 모드는 WebRTC가 불가능한 환경(기업 방화벽 등)에서 활성화되므로, 이후 WebRTC 시도는 의미가 없다.
- **코드 근거**: `hooks/useWebRTC.ts` (createPeerConnection, L200)

#### POL-007: ICE candidate 버퍼링 (setRemoteDescription 완료 전)
- **규칙**: SDP 원격 기술(setRemoteDescription) 완료 전 수신된 ICE 연결 후보는 버퍼에 보관하고 완료 후 일괄 적용한다.
- **조건**: remoteDescriptionSet === false인 경우 pendingCandidates 배열에 누적
- **위반 시**: addIceCandidate 즉시 호출 시 오류 발생 (race condition)
- **비즈니스 배경**: WebRTC 협상 과정에서 ICE candidate가 SDP offer/answer보다 먼저 도착할 수 있다. setRemoteDescription 완료 전 addIceCandidate를 호출하면 브라우저 오류가 발생하므로 버퍼링이 필요하다.
- **코드 근거**: `hooks/useWebRTC.ts` (ice_candidates 핸들러, L421-426)

#### POL-008: offer 선도착 race condition 방어
- **규칙**: peer_joined 이벤트보다 offer가 먼저 도착하는 경우 방어적으로 PeerConnection을 생성한다.
- **조건**: offer 이벤트 수신 시 peersRef에 해당 peerId가 없으면 createPeerConnection 호출 후 진행
- **위반 시**: PeerConnection 없이 offer 처리 불가로 해당 피어와 연결 실패
- **비즈니스 배경**: 네트워크 레이어에서 이벤트 순서가 보장되지 않으므로 방어 처리가 필요하다.
- **코드 근거**: `hooks/useWebRTC.ts` (offer 핸들러, L349-352)

### 상태 정책

#### POL-009: ICE 연결 실패 시 즉시 피어 이탈 처리
- **규칙**: ICE 연결 상태가 'failed'가 되면 즉시 PeerConnection을 닫고 피어 이탈로 처리한다.
- **전이**: ICE 연결 중 → 피어 이탈
- **전이 조건**: iceConnectionState === 'failed'
- **역전이**: 불가 — 이탈 처리된 피어는 peer_joined 이벤트를 통해 재접속해야 함
- **영향**: participants 목록에서 해당 피어 제거, 투표 완료 조건 재계산
- **코드 근거**: `hooks/useWebRTC.ts` (oniceconnectionstatechange, L250-255)

#### POL-010: P2P 연결 상태 이상 시 피어 이탈 처리
- **규칙**: WebRTC 연결 상태(connectionState)가 disconnected, failed, closed 중 하나가 되면 피어 이탈로 처리한다.
- **전이**: P2P 연결 활성 → 피어 이탈
- **전이 조건**: connectionState가 'disconnected' | 'failed' | 'closed'
- **역전이**: 불가 — 재접속 필요
- **영향**: participants 목록 업데이트, 투표 완료 조건 재계산
- **코드 근거**: `hooks/useWebRTC.ts` (onconnectionstatechange, L237-245)

### 설정값

#### POL-011: ICE candidate 배치 전송 윈도우
- **설정**: ICE candidate 배치 윈도우 = 100ms
- **비즈니스 의미**: ICE candidate 이벤트가 연속으로 발생할 때 100ms 내의 것들을 하나의 요청으로 묶어 전송한다. 시그널링 서버 왕복 횟수를 줄여 WebRTC 연결 수립 속도를 개선한다.
- **변경 시 영향**: 값을 줄이면 더 빠르게 전송되나 요청 수 증가. 값을 늘리면 요청 수는 줄지만 첫 연결까지 지연 증가. null candidate(gathering 완료) 수신 시에는 윈도우 무관하게 즉시 전송된다.
- **코드 근거**: `hooks/useWebRTC.ts` (createPeerConnection — candidateTimer, L227)

### 에러 시나리오

#### ERR-002: WebRTC offer 생성 오류
- **메시지**: "[WebRTC] offer creation error: {오류 내용}" (콘솔 경고)
- **발생 조건**: createOffer() 또는 setLocalDescription() 호출 실패 (브라우저 WebRTC API 오류)
- **사용자 영향**: 해당 피어와 P2P 연결 실패. 8초 후 서버 릴레이 모드로 자동 전환되어 기능은 유지됨.
- **대응 방법**: 자동으로 릴레이 모드로 전환되므로 별도 조치 불필요. PokerTable에 "서버 중계 모드" 배지가 표시된다.
- **코드 근거**: `hooks/useWebRTC.ts` (createPeerConnection — offer 생성, L270)

#### ERR-003: WebRTC offer/answer 협상 오류
- **메시지**: "[WebRTC] offer negotiation error: {오류}" / "[WebRTC] answer negotiation error: {오류}" (콘솔 경고)
- **발생 조건**: offer 수신 후 setRemoteDescription/createAnswer 실패, 또는 answer 수신 후 setRemoteDescription 실패
- **사용자 영향**: 해당 피어와 P2P 연결 실패. 8초 후 서버 릴레이 모드로 자동 전환.
- **대응 방법**: 자동 릴레이 전환으로 해소. 지속 발생 시 네트워크 환경 확인.
- **코드 근거**: `hooks/useWebRTC.ts` (offer 핸들러 L376-378, answer 핸들러 L404-406)

#### ERR-004: ICE candidate 적용 오류
- **메시지**: "[WebRTC] buffered addIceCandidate failed: {오류}" / "[WebRTC] addIceCandidate failed: {오류}" (콘솔 경고)
- **발생 조건**: addIceCandidate() 호출 실패. 버퍼링된 candidate 일괄 적용 중 또는 실시간 적용 중 발생 가능
- **사용자 영향**: 특정 ICE 경로 후보 무시, 나머지 candidate로 연결 시도 계속. 심각한 경우 연결 실패 후 릴레이 전환.
- **대응 방법**: 대부분 자동으로 다른 경로를 통해 연결되거나 릴레이로 전환됨.
- **코드 근거**: `hooks/useWebRTC.ts` (L365-367, L399-401, L430-432)

---

## realtime.서버_릴레이_폴백

### 상태 정책

#### POL-012: WebRTC 실패 시 서버 릴레이로 자동 전환
- **규칙**: 첫 피어 발견 후 8초 이내 DataChannel이 하나도 열리지 않으면 서버 릴레이 모드로 자동 전환한다.
- **전이**: connecting → relay
- **전이 조건**: RELAY_FALLBACK_TIMEOUT(8초) 경과 후 열린 DataChannel 없음 AND 피어가 1명 이상 존재
- **역전이**: 불가 — 릴레이 모드는 세션 내에서 해제되지 않음
- **영향**: TransportMode가 'relay'로 변경되어 PokerTable에 "서버 중계 모드" 배지 표시. 이후 모든 게임 메시지가 서버 경유.
- **코드 근거**: `hooks/useWebRTC.ts` (scheduleRelayFallback, L133-151)

#### POL-013: DataChannel 성공 시 릴레이 폴백 취소
- **규칙**: WebRTC DataChannel이 열리면 릴레이 폴백 타이머를 즉시 취소한다.
- **전이**: connecting → p2p
- **전이 조건**: DataChannel onopen 이벤트 발생 (WebRTC 연결 성공)
- **역전이**: 불가 — P2P 성공 후에도 릴레이로 되돌아가지 않음
- **영향**: TransportMode가 'p2p'로 변경, 릴레이 전환 없음
- **코드 근거**: `hooks/useWebRTC.ts` (setupDataChannel — channel.onopen, L157-163)

#### POL-014: 릴레이 모드 단방향 전환 보장
- **규칙**: 릴레이 모드는 한 번 활성화되면 같은 세션에서 해제되지 않는다.
- **전이**: 해당 없음 (단방향 잠금)
- **전이 조건**: activateRelayMode() 진입 시 relayModeRef.current === true이면 즉시 반환
- **역전이**: 불가 — 의도적 설계. 릴레이 모드 해제 후 P2P 재시도는 지원하지 않음.
- **영향**: 릴레이 모드 중 DataChannel이 열려도 TransportMode 변경 없음
- **코드 근거**: `hooks/useWebRTC.ts` (activateRelayMode, L110)

#### POL-015: 릴레이 전환 시 sync_request는 initiator만 전송
- **규칙**: 릴레이 모드 전환 시 게임 상태 동기화 요청(sync_request)은 신규 피어(initiator) 측에서만 전송한다.
- **전이 조건**: activateRelayMode() 시 entry.isInitiator === true인 경우만 sync_request 전송
- **역전이**: 해당 없음
- **영향**: 호스트(기존 피어)가 빈 sync_response를 받는 문제 방지. 게임 상태가 올바르게 신규 피어에게만 전달됨.
- **코드 근거**: `hooks/useWebRTC.ts` (activateRelayMode, L124-127)

### 설정값

#### POL-016: 서버 릴레이 폴백 타임아웃
- **설정**: RELAY_FALLBACK_TIMEOUT = 8,000ms (8초)
- **비즈니스 의미**: WebRTC P2P 연결 실패를 판정하기 전 대기하는 시간. 기업 방화벽(Zscaler, Symmetric NAT)처럼 WebRTC가 불가능한 환경에서 8초 후 자동으로 서버 중계 모드로 전환하여 서비스를 정상 이용 가능하게 한다.
- **변경 시 영향**: 값을 줄이면 불안정한 네트워크에서 불필요한 릴레이 전환 증가. 값을 늘리면 기업 보안 환경 사용자의 대기 시간 증가.
- **코드 근거**: `hooks/useWebRTC.ts` (RELAY_FALLBACK_TIMEOUT 상수, L40)

### 에러 시나리오

#### ERR-005: 서버 릴레이 모드 자동 전환
- **메시지**: "[WebRTC] Switching to server relay mode (WebRTC unavailable)" (콘솔 정보)
- **발생 조건**: 8초 타임아웃 경과 후 DataChannel이 하나도 열리지 않음 (Zscaler, Symmetric NAT, 엄격한 방화벽 환경)
- **사용자 영향**: PokerTable 상단에 "서버 중계 모드" 배지가 표시됨. 기능은 정상 동작하나 메시지가 서버를 경유하므로 약간의 지연 가능성 있음. Planning Poker는 초경량 텍스트 교환이므로 체감 성능 차이는 미미.
- **대응 방법**: 별도 조치 불필요. 자동으로 전환되어 서비스가 정상 동작함.
- **코드 근거**: `hooks/useWebRTC.ts` (activateRelayMode, L113)

---

## realtime.피어_이탈_처리

### Validation 규칙

#### POL-017: 피어 이탈 중복 처리 방지
- **규칙**: 동일 피어에 대한 이탈 처리(peer_left 브로드캐스트)는 최초 1회만 실행한다.
- **조건**: removePeer() 반환값이 true(실제로 제거됨)인 경우에만 peer_left 브로드캐스트
- **위반 시**: 이미 제거된 피어에 대해 peer_left 중복 전송하면 다른 참가자에서 removeParticipant가 두 번 호출될 수 있음
- **비즈니스 배경**: sendBeacon POST leave와 SSE abort 두 경로가 동시에 발생할 수 있어 중복 방지가 필요하다.
- **코드 근거**: `app/api/signaling/[roomId]/route.ts` (POST leave 핸들러 L92-95, SSE abort L55-58)

#### POL-018: DataChannel onclose에서 피어 이탈 처리 생략
- **규칙**: DataChannel이 닫히는 이벤트(onclose)에서는 피어 이탈 처리를 하지 않는다. peer_left SSE 이벤트 경로만 사용한다.
- **조건**: DataChannel.onclose 핸들러가 의도적으로 비어 있음
- **위반 시**: onclose와 peer_left SSE 두 경로가 모두 onPeerDisconnected를 호출하면 removeParticipant 이중 호출로 참가자 목록 오류 가능
- **비즈니스 배경**: 이탈 처리 경로를 peer_left SSE 하나로 단일화하여 중복 처리를 방지하는 설계 결정이다.
- **코드 근거**: `hooks/useWebRTC.ts` (setupDataChannel — channel.onclose, L185-187)

#### POL-019: 빈 방 자동 정리
- **규칙**: 방의 마지막 피어가 제거되면 서버 메모리에서 방(roomId)도 즉시 삭제한다.
- **조건**: removePeer() 후 room.size === 0이면 rooms.delete(roomId)
- **위반 시**: 빈 방이 메모리에 무기한 잔존하여 메모리 누수 발생
- **비즈니스 배경**: 서버가 인메모리 Map으로 방을 관리하므로 사용되지 않는 방을 즉시 정리해야 한다.
- **코드 근거**: `lib/signalingStore.ts` (removePeer, L34)

---

## realtime.DataChannel_메시지_전송

### Validation 규칙

#### POL-020: P2P 전송 시 채널 상태 검증
- **규칙**: P2P 모드에서 DataChannel로 메시지를 전송할 때 채널의 상태(readyState)가 'open'인 경우에만 전송한다.
- **조건**: broadcast에서 `channel.readyState === 'open'`, sendToPeer에서 `entry.channel.readyState === 'open'`
- **위반 시**: closed 또는 connecting 상태 채널에 전송을 시도하면 브라우저 오류 발생. 해당 채널은 건너뜀.
- **비즈니스 배경**: DataChannel이 아직 협상 중이거나 이미 닫힌 경우 메시지 전송을 강제하면 예외가 발생한다.
- **코드 근거**: `hooks/useWebRTC.ts` (broadcast L491, sendToPeer L506)

#### POL-021: 메시지 JSON 파싱 실패 무시
- **규칙**: DataChannel로 수신된 메시지의 JSON 파싱이 실패하면 조용히 무시한다.
- **조건**: JSON.parse 예외 발생 시 빈 catch 블록으로 처리
- **위반 시**: 파싱 불가 메시지가 게임 상태에 영향을 주지 않음
- **비즈니스 배경**: 손상된 메시지나 예상치 못한 형식의 데이터가 전체 게임 상태를 망가뜨리지 않도록 방어한다.
- **코드 근거**: `hooks/useWebRTC.ts` (setupDataChannel — channel.onmessage, L180-182)

#### POL-022: broadcast 시 발신자 자신 제외
- **규칙**: broadcast는 메시지를 보낸 피어(발신자) 자신에게는 전달하지 않는다.
- **조건**: signalingStore.broadcast에서 peerId === fromId인 경우 건너뜀
- **위반 시**: 자신의 메시지를 수신하면 투표/상태 변경이 이중 적용될 수 있음
- **비즈니스 배경**: 게임 상태는 발신자 측에서 이미 로컬로 처리되므로, 자신의 메시지를 다시 받으면 중복 처리가 발생한다.
- **코드 근거**: `lib/signalingStore.ts` (broadcast 함수, L64)
