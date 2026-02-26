# 🃏 Jira Joker: Real-time Planning Poker

**Jira Joker**는 WebRTC 기반의 실시간 P2P 통신을 활용하여, Jira 티켓의 스토리 포인트를 팀원들과 함께 산정하는 초고속 플래닝 포커 서비스입니다.

## 🚀 Overview

이 프로젝트는 서버의 개입을 최소화하고 참여자 간의 직접적인 데이터 교환(WebRTC)을 통해 실시간 투표 경험을 제공합니다. Jira API Token을 연동하여 투표 결과를 즉시 Jira 티켓에 반영할 수 있습니다.

## 🛠 Tech Stack

* **Framework:** Next.js (App Router)
* **Real-time:** WebRTC (DataChannel for P2P Sync)
* **Jira Integration:** Jira REST API (via API Token)
* **Styling:** Tailwind CSS + shadcn/ui
* **State Management:** Zustand (Client-side)

## 🎯 Core Features & Logic

### 1. Jira Ticket Sync

* **Host Login:** 개설자가 Jira Domain, Email, API Token을 입력하여 세션을 생성합니다.
* **Ticket Fetching:** Next.js API Route(Proxy)를 통해 특정 프로젝트의 이슈 목록을 가져옵니다.

### 2. Real-time Voting (WebRTC)

* **P2P Connection:** 방 개설 시 생성된 고유 ID를 통해 참여자들이 Mesh 네트워크로 연결됩니다.
* **Blind Voting:** 투표 단계에서는 '투표 완료 상태'만 공유하며, 실제 선택 값은 로컬에 보관합니다.
* **Auto-Reveal:** 모든 인원이 투표를 마치면 2초 카운트다운 후 실제 데이터를 동기화합니다.
* **Card Deck:** 피보나치 수열 (1, 2, 3, 5, 8, 13, 21) + `?` + `☕`.

### 3. Results & Write-back

* **Stats:** 최다 선택 값(Mode)과 평균값(Average)을 실시간 계산하여 출력합니다.
* **Jira Update:** 합의된 포인트를 클릭 한 번으로 Jira의 `Story Points` 필드에 업데이트합니다.

## 🗺 Implementation Roadmap (For AI Developer)

1. **Step 1: Setup API Proxy**
* Jira API Token을 안전하게 처리하는 `/api/jira` 엔드포인트 구현.
* 이슈 목록 조회 및 스토리 포인트 업데이트(PUT) 로직 포함.


2. **Step 2: WebRTC Signaling Layer**
* 초대 링크 생성을 위한 UUID 기반 라우팅 및 시그널링 서버 연결 로직 구축.


3. **Step 3: Poker UI & State**
* Zustand를 활용한 투표 상태 관리 및 카드 컴포넌트 구현.


4. **Step 4: Reveal & Sync Logic**
* 모든 유저 투표 완료 시 2초 대기 후 데이터 채널을 통한 값 동기화 및 결과 시각화.