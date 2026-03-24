# 실시간 통신 도메인 - 용어집

> 최종 갱신: 2026-03-25

---

## D

### DataChannel (데이터채널)
- **정의**: WebRTC P2P 연결 위에서 게임 메시지를 직접 주고받는 채널. 서버를 거치지 않고 참가자 간에 데이터를 전달한다.
- **코드 표현**: `RTCDataChannel`, `channel`, `entry.channel`, 채널 이름 `'game'`
- **유사어·혼동 주의**: SSE(서버 → 클라이언트 단방향)와 달리, DataChannel은 클라이언트 ↔ 클라이언트 양방향 직접 통신이다. 릴레이 모드에서는 DataChannel 대신 서버 경유 POST/SSE 경로를 사용한다.
- **사용 위치**: PeerConn 엔티티의 `channel` 필드, realtime.WebRTC_P2P_협상, realtime.DataChannel_메시지_전송
- **예시**: `channel.readyState === 'open'` 일 때만 `channel.send(JSON.stringify(msg))` 호출

### DataMessage (데이터메시지)
- **정의**: 참가자 간에 교환되는 게임 이벤트 메시지. type 필드로 10가지 종류를 구분하는 discriminated union 타입이다.
- **코드 표현**: `DataMessage` 타입 (hooks/useWebRTC.ts)
- **유사어·혼동 주의**: SSE 이벤트(room_state, peer_joined, peer_left 등)는 시그널링 용도이고, DataMessage는 게임 진행 용도이다. 두 채널의 메시지 종류를 혼동하지 않도록 주의.
- **사용 위치**: realtime.DataChannel_메시지_전송, broadcast/sendToPeer 인자
- **예시**: `{ type: 'voted', from: 'peer-123' }`, `{ type: 'reveal', from: 'peer-456', vote: '8' }`, `{ type: 'kick', targetId: 'peer-789' }`

## H

### heartbeat (하트비트)
- **정의**: 서버가 15초마다 SSE 스트림에 전송하는 keep-alive 신호. 실제 데이터 없이 연결이 살아있음을 확인하는 용도이다.
- **코드 표현**: `': heartbeat\n\n'` 문자열, `heartbeatInterval` (setInterval 15,000ms)
- **유사어·혼동 주의**: DataMessage의 game 메시지와 다르다. heartbeat는 SSE 프로토콜 레이어의 신호이며 FE에서 이벤트로 수신되지 않는다 (SSE comment 형식 `: ...`).
- **사용 위치**: realtime.SSE_시그널링_연결, app/api/signaling/[roomId]/route.ts
- **예시**: 탭을 15초 이상 유지하면 서버가 `: heartbeat` 프레임을 전송하여 Nginx 등 프록시의 연결 타임아웃을 방지

## I

### ICE candidate (ICE 후보)
- **정의**: WebRTC 연결을 위한 네트워크 경로 후보 (IP 주소 + 포트 번호 조합). STUN 서버를 통해 자신의 퍼블릭 주소를 발견하여 상대방에게 전달한다.
- **코드 표현**: `RTCIceCandidateInit`, `candidates` (배열), `pendingCandidates`, `candidate.toJSON()`
- **유사어·혼동 주의**: SDP(Session Description Protocol, offer/answer)와 다르다. SDP는 미디어/데이터 협상 정보이고, ICE candidate는 실제 연결 경로 탐색 정보이다. 두 과정은 순서가 다르게 진행될 수 있어 ICE candidate 버퍼링이 필요하다.
- **사용 위치**: PeerConn.pendingCandidates, realtime.WebRTC_P2P_협상
- **예시**: `{ candidate: 'candidate:0 1 UDP 2122252543 192.168.1.100 54321 typ host', ... }`

### Initiator (이니시에이터)
- **정의**: 방에 새로 입장하는 피어. room_state 이벤트를 받는 쪽. WebRTC offer 생성, DataChannel 생성, 상태 동기화 요청(sync_request) 전송을 담당한다.
- **코드 표현**: `isInitiator: true`, `PeerConn.isInitiator`
- **유사어·혼동 주의**: 호스트(host)와 다르다. Initiator는 해당 P2P 연결 쌍에서의 역할(offer를 먼저 보내는 쪽)이고, 호스트는 게임 진행을 관리하는 비즈니스 역할이다. 방 생성자도 다른 사람이 입장하면 그 사람이 새 연결의 Initiator가 된다.
- **사용 위치**: PeerConn 엔티티, createPeerConnection, activateRelayMode
- **예시**: 방에 3명이 있을 때 4번째 참가자가 입장하면, 4번째 참가자 기준으로 기존 3명 모두에 대해 isInitiator=true

## M

### Mesh Network (풀 메시 네트워크)
- **정의**: 모든 참가자가 서로 1:1 직접 연결을 맺는 네트워크 구조. N명이 참가하면 N*(N-1)/2개의 P2P 연결이 수립된다.
- **코드 표현**: `peersRef: Map<string, PeerConn>` (각 peerId별로 독립된 PeerConn 관리)
- **유사어·혼동 주의**: 스타(star) 토폴로지(중앙 서버/호스트가 중계)와 다르다. 메시 네트워크는 서버 부하가 없지만 참가자 수가 많아질수록 각 클라이언트의 연결 수가 증가한다.
- **사용 위치**: realtime 도메인 전체
- **예시**: 4명 참가 시 6개의 RTCPeerConnection (4*3/2=6)

## P

### PeerConn (피어연결)
- **정의**: 클라이언트 브라우저 메모리에서 관리하는 특정 피어와의 연결 상태 객체. WebRTC PeerConnection, DataChannel, ICE 버퍼를 포함한다. 릴레이 모드에서는 pc/channel 없이 이름과 역할 정보만 유지된다.
- **코드 표현**: `PeerConn` 인터페이스, `peersRef: Map<peerId, PeerConn>`
- **유사어·혼동 주의**: 서버의 PeerEntry와 다르다. PeerEntry는 서버 측 SSE 스트림 관리 객체이고, PeerConn은 클라이언트 측 WebRTC 연결 관리 객체이다.
- **사용 위치**: hooks/useWebRTC.ts 전체
- **예시**: `{ pc: RTCPeerConnection, channel: RTCDataChannel, name: '김철수', isInitiator: true, remoteDescriptionSet: true, pendingCandidates: [] }`

### PeerEntry (피어엔트리)
- **정의**: 서버(signalingStore) 인메모리에 보관되는 피어 레코드. 해당 피어의 SSE 스트림에 이벤트를 전달하기 위한 컨트롤러를 포함한다.
- **코드 표현**: `PeerEntry` 인터페이스, `rooms: Map<roomId, Map<peerId, PeerEntry>>`
- **유사어·혼동 주의**: 클라이언트의 PeerConn과 다르다. PeerEntry는 서버가 피어에게 SSE를 push하기 위한 도구이고, PeerConn은 클라이언트가 해당 피어와 WebRTC를 관리하기 위한 객체이다.
- **사용 위치**: lib/signalingStore.ts, realtime.SSE_시그널링_연결
- **예시**: `{ name: '김철수', controller: ReadableStreamDefaultController, encoder: TextEncoder }`

### pendingCandidates (ICE 후보 버퍼)
- **정의**: setRemoteDescription(원격 SDP 기술 설정) 완료 전에 수신된 ICE candidate를 임시로 보관하는 배열. SDP 설정 완료 후 일괄 적용된다.
- **코드 표현**: `PeerConn.pendingCandidates: RTCIceCandidateInit[]`, `entry.pendingCandidates`
- **유사어·혼동 주의**: ICE candidate 배치 전송용 `pendingCandidates`(로컬 변수, createPeerConnection 내부)와 이름이 같지만 역할이 다르다. PeerConn의 pendingCandidates는 "수신된 상대방 candidate 버퍼"이고, createPeerConnection 내부의 pendingCandidates는 "발신할 내 candidate 묶음"이다.
- **사용 위치**: PeerConn 엔티티, ice_candidates SSE 핸들러
- **예시**: offer 수신 직후 ICE candidate가 오면 remoteDescriptionSet=false이므로 pendingCandidates에 쌓이고, createAnswer 완료 후 일괄 addIceCandidate

## R

### Relay (릴레이)
- **정의**: WebRTC P2P 연결 실패 시 서버가 메시지를 중개하는 폴백 전송 모드. 기업 방화벽이나 Symmetric NAT 환경에서 자동으로 활성화된다.
- **코드 표현**: `relayModeRef`, `sendRelay()`, `TransportMode = 'relay'`, POST body `type: 'relay'`
- **유사어·혼동 주의**: TURN 서버(미디어 릴레이)와 다르다. 이 릴레이는 기존 시그널링 서버 인프라(/api/signaling)를 재사용하는 application-level 릴레이이다. WebRTC 미디어 릴레이와 달리 추가 서버가 필요 없다.
- **사용 위치**: TransportMode, realtime.서버_릴레이_폴백, broadcast/sendToPeer
- **예시**: `POST /api/signaling/{roomId}` body: `{ from: 'peer-A', to: 'peer-B', type: 'relay', payload: { msg: { type: 'voted', from: 'peer-A' } } }`

## S

### Signaling (시그널링)
- **정의**: WebRTC P2P 연결을 수립하기 전에 SDP offer/answer와 ICE candidate를 교환하는 절차. `/api/signaling/[roomId]` 엔드포인트가 중개한다.
- **코드 표현**: `sendSignal()`, `GET/POST /api/signaling/[roomId]`, EventSource
- **유사어·혼동 주의**: 시그널링은 연결 수립을 위한 협상 과정이고, DataChannel은 연결 수립 후의 실제 데이터 전송 채널이다. 시그널링 서버는 연결 수립 후에는 릴레이 폴백 용도로만 사용된다.
- **사용 위치**: realtime.SSE_시그널링_연결, realtime.WebRTC_P2P_협상
- **예시**: 시그널링 흐름 — EventSource 연결 → room_state 수신 → offer 전송 → answer 수신 → ice_candidates 교환 → DataChannel open

### SSE (Server-Sent Events)
- **정의**: 서버에서 클라이언트로의 단방향 HTTP 스트림. 시그널링 이벤트(room_state, peer_joined, peer_left, offer, answer, ice_candidates, relay)를 서버가 클라이언트에게 push하는 데 사용된다.
- **코드 표현**: `EventSource`, `ReadableStream`, `Content-Type: text/event-stream`
- **유사어·혼동 주의**: WebSocket(양방향)과 달리 SSE는 서버 → 클라이언트 단방향이다. 클라이언트 → 서버 메시지는 별도의 POST 요청으로 처리한다.
- **사용 위치**: realtime.SSE_시그널링_연결, app/api/signaling/[roomId]/route.ts
- **예시**: `event: peer_joined\ndata: {"peerId":"abc","name":"김철수"}\n\n`

### STUN Server (STUN 서버)
- **정의**: NAT(네트워크 주소 변환) 뒤에 있는 클라이언트가 자신의 퍼블릭 IP 주소와 포트를 발견하도록 돕는 서버. WebRTC ICE candidate 수집에 사용된다.
- **코드 표현**: `RTC_CONFIG.iceServers`, `stun:stun.l.google.com:19302`
- **유사어·혼동 주의**: TURN 서버(미디어/데이터를 직접 중계)와 다르다. STUN은 주소 발견만 도와주고 실제 데이터는 P2P로 흐른다. 이 프로젝트는 TURN 없이 서버 릴레이로 폴백한다.
- **사용 위치**: RTC_CONFIG (hooks/useWebRTC.ts), realtime.WebRTC_P2P_협상
- **예시**: Google STUN 서버 3개 멀티플렉싱 (`stun.l.google.com`, `stun1`, `stun2`) — 하나가 차단되어도 나머지로 주소 발견 가능

## T

### TransportMode (전송 모드)
- **정의**: 현재 클라이언트의 실시간 메시지 전송 방식을 나타내는 상태값. 'connecting'(초기), 'p2p'(WebRTC 성공), 'relay'(서버 중계) 세 가지 값을 가진다.
- **코드 표현**: `TransportMode` 타입, `transportMode` 상태 (useState), `setTransportMode()`
- **유사어·혼동 주의**: P2P 연결 성공 후 'relay'로는 돌아가지 않는다. 'connecting'에서만 'p2p' 또는 'relay'로 전이 가능하며, 둘 다 단방향 전환이다.
- **사용 위치**: useWebRTC 반환값, PokerTable 컴포넌트 ("서버 중계 모드" 배지 표시 조건)
- **예시**: TransportMode 전이 — `connecting` → (DataChannel open) → `p2p`; `connecting` → (8초 타임아웃) → `relay`
