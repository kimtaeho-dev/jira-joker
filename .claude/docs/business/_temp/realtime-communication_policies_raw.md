# realtime-communication 비즈니스 규칙 추출 결과

## 정책

### poker.sse_connection 관련 정책

- POL-001: 참가자 식별자와 이름 필수 제공
  - 조건 (코드 원문): `if (!peerId || !name) return new Response('Missing peerId or name', { status: 400 })`
  - 조건 (비즈니스 번역): 방에 입장할 때 참가자 식별자와 표시 이름이 반드시 포함되어야 한다
  - 위반 시: HTTP 400 응답 반환, SSE 채널 개설 불가
  - 코드 근거: app/api/signaling/[roomId]/route.ts:23-25

- POL-002: 방 입장 즉시 기존 참가자 목록 수신
  - 조건 (코드 원문): `const existingPeers = getExistingPeers(roomId).filter((p) => p.id !== peerId); controller.enqueue(roomStateChunk)`
  - 조건 (비즈니스 번역): 신규 참가자가 연결되는 즉시 자신을 제외한 기존 참가자 목록(room_state)을 수신한다
  - 위반 시: 해당 없음 (정상 플로우)
  - 코드 근거: app/api/signaling/[roomId]/route.ts:34-39

- POL-003: 신규 참가자 진입 시 기존 참가자 전원 알림
  - 조건 (코드 원문): `broadcast(roomId, peerId, 'peer_joined', { peerId, name })`
  - 조건 (비즈니스 번역): 신규 참가자가 방에 진입하면 발신자를 제외한 기존 참가자 전원에게 peer_joined 이벤트가 전송된다
  - 위반 시: 해당 없음 (정상 플로우)
  - 코드 근거: app/api/signaling/[roomId]/route.ts:41

- POL-004: SSE 하트비트 15초 주기
  - 조건 (코드 원문): `setInterval(() => { controller.enqueue(encoder.encode(': heartbeat\n\n')) }, 15_000)`
  - 조건 (비즈니스 번역): 모든 활성 SSE 연결에 15초마다 빈 하트비트 프레임 전송. 스트림이 닫혀 있으면 인터벌 중단
  - 위반 시: 해당 없음 (설정값)
  - 코드 근거: app/api/signaling/[roomId]/route.ts:43-50

### poker.webrtc_negotiation 관련 정책

- POL-005: Offer 발신 주체는 항상 신규 진입 참가자
  - 조건 (코드 원문): `createPeerConnection(peer.id, peer.name, true)` (room_state 수신측 = isInitiator=true) vs `createPeerConnection(peerId, name, false)` (peer_joined 수신측)
  - 조건 (비즈니스 번역): WebRTC 협상에서 Offer를 먼저 생성하는 역할은 항상 신규 진입 참가자가 담당, 기존 참가자는 Answer 반환
  - 위반 시: 양측 동시 Offer 생성 시 협상 충돌(glare)로 연결 실패
  - 코드 근거: hooks/useWebRTC.ts:258-270, 299-316, 320-336

- POL-006: Offer 도착 전 ICE candidate 버퍼링
  - 조건 (코드 원문): `if (!entry.remoteDescriptionSet) { entry.pendingCandidates.push(...candidates); return }`
  - 조건 (비즈니스 번역): remoteDescription 설정 완료 전 수신된 ICE candidate는 버퍼에 저장하고 Offer/Answer 수신 후 일괄 적용
  - 위반 시: 원격 정보 없이 candidate 적용 시 연결 수립 실패
  - 코드 근거: hooks/useWebRTC.ts:421-426

- POL-007: ICE candidate 100ms 배치 전송
  - 조건 (코드 원문): `candidateTimer = setTimeout(flushCandidates, 100)` / ICE gathering 완료 시 즉시 flush
  - 조건 (비즈니스 번역): ICE candidate를 100ms 구간에 수집 후 일괄 전송. ICE gathering 완료 시 잔여 즉시 전송
  - 위반 시: 해당 없음 (성능 최적화 설정)
  - 코드 근거: hooks/useWebRTC.ts:212-232

- POL-008: STUN 서버 3개 병렬 사용
  - 조건 (코드 원문): `iceServers: [stun.l.google.com:19302, stun1.l.google.com:19302, stun2.l.google.com:19302]`
  - 조건 (비즈니스 번역): P2P 연결 시도 시 외부 STUN 서버 3개를 동시 활용해 NAT 주소를 수집
  - 위반 시: 해당 없음 (인프라 설정)
  - 코드 근거: hooks/useWebRTC.ts:32-37

### poker.relay_fallback 관련 정책

- POL-009: P2P 연결 실패 시 8초 후 서버 릴레이 자동 전환
  - 조건 (코드 원문): `const RELAY_FALLBACK_TIMEOUT = 8_000` / `if (!hasOpenChannel && peersRef.current.size > 0) { activateRelayMode() }`
  - 조건 (비즈니스 번역): 참가자가 1명 이상 존재하는 방에서 8초 이내에 P2P DataChannel이 열리지 않으면 서버 릴레이 모드로 자동 전환
  - 위반 시: 해당 없음 (자동 전환)
  - 코드 근거: hooks/useWebRTC.ts:40, 133-151

- POL-010: P2P DataChannel 개통 시 릴레이 전환 타이머 즉시 취소
  - 조건 (코드 원문): `if (relayFallbackTimerRef.current) { clearTimeout(relayFallbackTimerRef.current); relayFallbackTimerRef.current = null }`
  - 조건 (비즈니스 번역): P2P DataChannel open 이벤트 수신 시 릴레이 전환 대기 타이머를 즉시 취소하고 TransportMode를 'p2p'로 전환
  - 위반 시: 해당 없음 (정상 플로우)
  - 코드 근거: hooks/useWebRTC.ts:157-164

- POL-011: 릴레이 모드 전환 시 기존 PeerConnection 즉시 정리
  - 조건 (코드 원문): `entry.pc.close(); peersRef.current.set(peerId, { name: entry.name, isInitiator: entry.isInitiator })`
  - 조건 (비즈니스 번역): 서버 릴레이 모드로 전환 시 모든 기존 WebRTC PeerConnection을 즉시 닫고 이름 정보만 유지
  - 위반 시: 해당 없음 (리소스 정리)
  - 코드 근거: hooks/useWebRTC.ts:116-129

- POL-012: 릴레이 모드 중복 활성화 방지
  - 조건 (코드 원문): `if (relayModeRef.current) return`
  - 조건 (비즈니스 번역): 릴레이 모드는 한 번 활성화되면 이후 동일한 전환 시도를 무시
  - 위반 시: 해당 없음 (중복 방지)
  - 코드 근거: hooks/useWebRTC.ts:110

- POL-013: 릴레이 모드에서 신규 참가자 진입 시 WebRTC 협상 생략
  - 조건 (코드 원문): `if (relayModeRef.current) { peersRef.current.set(peer.id, { name: peer.name, isInitiator: true }); onPeerConnectedRef.current(peer.id, peer.name) }`
  - 조건 (비즈니스 번역): 릴레이 모드 운영 중 신규 참가자 진입 시 WebRTC 협상 없이 즉시 연결 완료 처리
  - 위반 시: 해당 없음 (모드 분기)
  - 코드 근거: hooks/useWebRTC.ts:298-306

- POL-014: 릴레이 모드 전환 시 신규 진입 참가자만 상태 동기화 요청
  - 조건 (코드 원문): `if (entry.isInitiator) { sendRelay({ type: 'sync_request', from: myId }, peerId) }` + 주석 "initiator(신규 피어)만 sync_request 전송 — 호스트가 빈 sync_response를 받는 것 방지"
  - 조건 (비즈니스 번역): 릴레이 모드 전환 시 신규 진입 참가자(initiator)만 게임 상태 동기화 요청 전송. 기존 참가자는 요청하지 않음
  - 위반 시: 기존 참가자가 동기화 요청 중복 전송 시 호스트가 빈 응답 수신 가능
  - 코드 근거: hooks/useWebRTC.ts:124-127

### poker.peer_disconnect 관련 정책

- POL-015: 피어 퇴장 중복 알림 방지
  - 조건 (코드 원문): `const removed = removePeer(roomId, peerId); if (removed) { broadcast(roomId, peerId, 'peer_left', { peerId }) }`
  - 조건 (비즈니스 번역): removePeer boolean 반환값으로 실제 제거 여부를 확인한 경우에만 peer_left 알림 전송
  - 위반 시: SSE abort + sendBeacon leave POST 경합 시 peer_left 이중 전송 가능
  - 코드 근거: app/api/signaling/[roomId]/route.ts:55-58, 91-96

- POL-016: 마지막 참가자 퇴장 시 방 자동 소멸
  - 조건 (코드 원문): `if (room.size === 0) rooms.delete(roomId)`
  - 조건 (비즈니스 번역): 방의 모든 참가자가 퇴장하면 서버 메모리에서 해당 방 정보가 즉시 삭제
  - 위반 시: 해당 없음 (자동 정리)
  - 코드 근거: lib/signalingStore.ts:34

- POL-017: ICE 연결 실패 즉시 참가자 해제
  - 조건 (코드 원문): `pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') { pc.close(); connectedPeersRef.current.delete(peerId); onPeerDisconnectedRef.current(peerId) } }` + 주석 "connectionState보다 빠르게 실패 감지"
  - 조건 (비즈니스 번역): WebRTC ICE 연결이 'failed' 상태로 전환되면 connectionState 이벤트보다 먼저 즉시 참가자 해제 처리
  - 위반 시: 해당 없음 (빠른 실패 감지)
  - 코드 근거: hooks/useWebRTC.ts:249-256

### poker.room_existence_check 관련 정책

- POL-018: 방 존재 여부는 활성 연결 기준
  - 조건 (코드 원문): `return rooms.has(roomId)` — rooms Map에 roomId 키 존재 여부
  - 조건 (비즈니스 번역): 서버 메모리에 활성 SSE 연결을 보유한 참가자가 있는 경우에만 방이 존재하는 것으로 판단
  - 위반 시: 해당 없음 (읽기 전용 확인)
  - 코드 근거: lib/signalingStore.ts:77-79

### poker.game_message_broadcast 관련 정책

- POL-019: P2P 모드에서 열린 DataChannel에만 전송
  - 조건 (코드 원문): `if (channel && channel.readyState === 'open') { channel.send(json) }`
  - 조건 (비즈니스 번역): P2P 모드에서 DataChannel이 open 상태인 참가자에게만 메시지 전달
  - 위반 시: 닫힌 채널에 전송 시 오류 발생
  - 코드 근거: hooks/useWebRTC.ts:491-493

- POL-020: 브로드캐스트는 발신자 본인 제외
  - 조건 (코드 원문): `if (peerId === fromId) continue`
  - 조건 (비즈니스 번역): 브로드캐스트 메시지는 발신자를 제외한 나머지 참가자에게만 전달
  - 위반 시: 발신자가 자신이 보낸 메시지를 재수신해 상태 중복 적용 발생
  - 코드 근거: lib/signalingStore.ts:64-66

- POL-021: 닫힌 SSE 스트림 전송 오류 무시
  - 조건 (코드 원문): `try { peer.controller.enqueue(chunk) } catch { // stream already closed }`
  - 조건 (비즈니스 번역): 이미 닫힌 SSE 스트림에 메시지 전송 시 오류를 무시하고 나머지 참가자 전송 계속
  - 위반 시: 오류 미처리 시 전체 브로드캐스트 루프 중단 가능
  - 코드 근거: lib/signalingStore.ts:49-53, 70-74

- POL-022: 릴레이 POST 수신자 지정 여부에 따른 전달 범위
  - 조건 (코드 원문): `if (to) { sendToPeer(roomId, to, type, ...) } else { broadcast(roomId, from, type, ...) }`
  - 조건 (비즈니스 번역): 서버 릴레이 메시지에서 수신자가 지정되면 해당 참가자에게만, 미지정이면 발신자 제외 전체에게 전달
  - 위반 시: sync_response가 전체에 전달되면 불필요한 상태 갱신 발생
  - 코드 근거: app/api/signaling/[roomId]/route.ts:99-103

---

## 에러 시나리오

- ERR-001: "Missing peerId or name"
  - 발생 조건: 참가자 식별자 또는 표시 이름 없이 SSE 채널 연결 요청
  - 사용자 영향: 방 입장 차단, 연결 즉시 종료
  - 대응 방법: 정상적인 방 URL로 재접근. 정상 사용 중 발생하지 않음
  - 코드 근거: app/api/signaling/[roomId]/route.ts:23-25

- ERR-002: (내부 경고 로그) '[WebRTC] offer creation error'
  - 발생 조건: WebRTC Offer/Answer 협상 오류 또는 ICE 연결 'failed' 상태 전환
  - 사용자 영향: 즉각적인 영향 없음. 8초 후 서버 릴레이 모드 자동 전환
  - 대응 방법: 사용자 조작 불필요 — 시스템이 서버 릴레이 모드로 자동 전환
  - 코드 근거: hooks/useWebRTC.ts:270, 376-378

- ERR-003: (내부 경고 로그) '[WebRTC] buffered addIceCandidate failed'
  - 발생 조건: 특정 ICE candidate 적용 과정에서 오류 발생
  - 사용자 영향: 해당 네트워크 경로 사용 불가. 다른 경로로 자동 재시도
  - 대응 방법: 사용자 조작 불필요 — 다른 ICE candidate로 자동 재시도되거나 릴레이 모드로 전환
  - 코드 근거: hooks/useWebRTC.ts:364-368, 398-402, 430-434

- ERR-004: (오류 무시) 릴레이 메시지 전송 실패
  - 발생 조건: 서버 릴레이 경유 메시지 전송 중 네트워크 오류
  - 사용자 영향: 해당 메시지 미전달. 일시적 게임 상태 불일치 가능
  - 대응 방법: 재시도 없음. 지속 발생 시 방 재입장으로 상태 재동기화
  - 코드 근거: hooks/useWebRTC.ts:91

---

## 상수/설정값

- P2P 연결 실패 후 서버 릴레이 전환 대기 시간: 8000ms (8초)
  - 코드 근거: hooks/useWebRTC.ts:40 `const RELAY_FALLBACK_TIMEOUT = 8_000`

- SSE 하트비트 전송 주기: 15000ms (15초)
  - 코드 근거: app/api/signaling/[roomId]/route.ts:50 `}, 15_000)`

- ICE candidate 배치 전송 윈도우: 100ms
  - 코드 근거: hooks/useWebRTC.ts:227 `candidateTimer = setTimeout(flushCandidates, 100)`

- STUN 서버 목록: stun.l.google.com:19302, stun1.l.google.com:19302, stun2.l.google.com:19302 (3개)
  - 코드 근거: hooks/useWebRTC.ts:32-37

- 서버 인메모리 방 상태 저장소 전략: globalThis 패턴 (HMR/모듈 재평가 시 데이터 유지)
  - 코드 근거: lib/signalingStore.ts:8-12

---

## 용어

- 피어: 방에 SSE 채널로 접속 중인 개별 참가자 (실시간 통신 연결 단위)
- 게임 메시지: WebRTC DataChannel 또는 서버 릴레이를 통해 교환되는 게임 상태 변경 데이터
- 시그널링: WebRTC P2P 연결 수립을 위한 SDP/ICE candidate 교환 과정
- 서버 릴레이 모드: P2P 연결 실패 시 SSE 채널로 게임 메시지를 중계하는 대체 전송 방식
- 하트비트: SSE 연결 유지를 위해 서버가 주기적으로 전송하는 빈 프레임
- 전송 경로(TransportMode): 연결 중 / P2P / 서버 릴레이 세 가지 메시지 전달 방식 상태
- ICE candidate: WebRTC P2P 연결 가능한 네트워크 경로 후보 (STUN 서버로 수집)
- Offer/Answer: WebRTC P2P 연결 수립을 위한 SDP 협상 쌍
- P2P DataChannel: WebRTC 연결 위 두 참가자 간 직접 게임 메시지 교환 채널 (채널명 'game')
- SSE(Server-Sent Events): 서버→클라이언트 단방향 이벤트 스트리밍 기술
- sync_request/sync_response: 신규 진입 참가자 게임 상태 초기 동기화 메시지 쌍
- 자발적 퇴장 신호: beforeunload 시 브라우저가 서버로 전송하는 퇴장 알림
- 브로드캐스트: 발신자 제외 방 전체 참가자에게 메시지를 전달하는 방식
- 서버 인메모리 방 상태: 서버가 메모리에 보관하는 방별 활성 참가자 목록 및 채널 핸들
