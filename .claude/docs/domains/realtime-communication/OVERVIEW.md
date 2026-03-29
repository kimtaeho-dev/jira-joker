# 실시간 통신 (realtime-communication) 도메인
> 최종 갱신: 2026-03-28

## 개요
WebRTC Full Mesh P2P 연결 및 SSE(Server-Sent Events) 기반 시그널링 채널을 통해 같은 방의 참가자들이 게임 상태 메시지를 실시간으로 주고받을 수 있게 한다. P2P 연결이 불가능한 환경에서는 서버 릴레이 모드로 자동 전환하여 연결 가용성을 보장한다.

## 앱 구성
- **poker**: SSE 시그널링 서버(BE) + WebRTC 클라이언트 훅(FE)을 모두 포함하는 단일 앱. 서버 측은 인메모리 signalingStore를 통해 방·피어 상태를 관리하고, 클라이언트 측은 useWebRTC 훅을 통해 DataChannel 메시지 전송과 수신 콜백을 상위 레이어에 제공한다.

## 핵심 엔티티
- PeerEntry
- PeerConn
- DataMessage
- TransportMode
- UseWebRTCOptions

## 외부 도메인 연관
- → 영향을 주는 도메인: room-management (게임 메시지 전달 채널 제공, 방 존재 여부 공급)
- ← 영향을 받는 도메인: room-management (SyncState 타입 참조, useWebRTC 훅 소비 및 메시지 처리)
