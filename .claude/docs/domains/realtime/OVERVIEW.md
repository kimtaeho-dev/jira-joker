# 실시간 통신 (realtime) 도메인

> 최종 갱신: 2026-03-25

## 개요

WebRTC P2P DataChannel과 SSE(Server-Sent Events) 기반 시그널링을 통해 Planning Poker 참가자 간 실시간 메시지를 중개하는 도메인이다. P2P 연결 실패 시 서버 릴레이로 자동 폴백하여 기업 보안 환경(Zscaler, Symmetric NAT)에서도 동작을 보장한다.

## 앱 구성

- **signaling API** (`app/api/signaling/[roomId]/route.ts`): SSE GET(피어 등록/이벤트 스트림) + POST(offer/answer/ICE/relay/leave) 시그널링 엔드포인트
- **useWebRTC hook** (`hooks/useWebRTC.ts`): Full Mesh RTCPeerConnection 수립, DataChannel 관리, 서버 릴레이 폴백, broadcast/sendToPeer API 제공
- **signalingStore** (`lib/signalingStore.ts`): 서버 인메모리 rooms Map 싱글톤 (피어 SSE 컨트롤러 관리)

## 핵심 엔티티

- PeerEntry — 서버(signalingStore) 인메모리 피어 레코드 (SSE 스트림 컨트롤러 포함)
- PeerConn — 클라이언트 인메모리 피어 연결 상태 (RTCPeerConnection + DataChannel + ICE 버퍼)
- DataMessage — P2P/릴레이로 교환되는 게임 메시지 discriminated union (10종)
- TransportMode — 현재 전송 모드 (`connecting` | `p2p` | `relay`)

상세 정의는 ENTITIES.md 참조.

## 외부 도메인 연관

- → 영향을 주는 도메인:
  - **poker** — DataChannel/릴레이로 voted/reveal/reset/next/sync_request/sync_response 메시지를 전달하여 투표 상태를 구동
  - **room** — onPeerConnected/onPeerDisconnected 콜백과 peer_left SSE 이벤트로 참가자 목록·호스트 이탈 감지에 활용됨; rooms Map에 roomId 등록으로 방 유효성 검사에 기여
- ← 영향을 받는 도메인:
  - **poker** — SyncState 타입을 직접 import하여 sync_response 메시지 구조에 사용 (poker 도메인의 상태 구조 변경 시 DataMessage 타입 정의에 영향)
  - **room** — beforeunload 시 sendBeacon POST type=leave로 서버 측 피어 이탈 처리 트리거
