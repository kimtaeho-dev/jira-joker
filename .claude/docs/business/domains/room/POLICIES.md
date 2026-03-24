# 방 관리 도메인 - 서비스 정책서

> 최종 갱신: 2026-03-25

---

## room.방_유효성_검사

### Validation 규칙

#### POL-001: 방 존재 여부 사전 검증
- **규칙**: 링크를 통해 방에 접근하는 신규 참가자는 반드시 서버에 방 존재 여부를 확인해야 한다.
- **조건**: 현재 사용자의 닉네임이 없거나, 저장된 방 ID가 URL의 방 ID와 다른 경우 (신규 참가 경로) → GET /api/room/{roomId} 호출
- **위반 시**: API 응답이 `exists: false`이거나 네트워크 오류가 발생하면 "방을 찾을 수 없습니다" 화면을 표시하고 JoinRoomForm을 렌더링하지 않는다.
- **비즈니스 배경**: 존재하지 않는 방에 참가를 시도하는 경우를 조기에 차단하여 불필요한 WebRTC 연결 시도를 막는다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (useEffect, 78-88번 라인)

#### POL-002: 이미 입장한 사용자 검증 우회
- **규칙**: 닉네임이 있고 저장된 방 ID가 URL과 일치하면 서버 API 호출 없이 유효한 방으로 즉시 인정한다.
- **조건**: myName이 설정되어 있고 storeRoomId === roomId인 경우
- **위반 시**: 해당 없음. 새로고침 시 방 API를 재호출하지 않아도 세션이 유지된다.
- **비즈니스 배경**: sessionStorage에 상태가 persist되므로 새로고침 후에도 재검증이 불필요하다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (useEffect, 80-83번 라인)

#### POL-003: 방 유효성 판정 기준 — 서버 SSE 연결 기반
- **규칙**: 방은 서버의 SSE 연결 테이블(rooms Map)에 해당 roomId가 등록되어 있을 때만 유효하다. 마지막 참가자가 서버 연결을 끊으면 방 항목이 자동 삭제된다.
- **조건**: signalingStore의 rooms Map에 roomId 키가 존재 → `roomExists() = true`
- **위반 시**: 방 항목이 없으면 `exists: false` 응답 → 방 없음 화면 표시
- **비즈니스 배경**: 별도의 방 데이터베이스 없이 SSE 연결 유무로 방의 생존 여부를 판단하는 경량 설계.
- **코드 근거**: `lib/signalingStore.ts` (roomExists, removePeer — 29-36, 77-79번 라인)

### 에러 시나리오

#### ERR-001: 방을 찾을 수 없음
- **메시지**: "방을 찾을 수 없습니다" / "존재하지 않거나 이미 종료된 방입니다."
- **발생 조건**: 방 유효성 API 응답이 `exists: false`이거나 API 호출 자체가 실패한 경우
- **사용자 영향**: JoinRoomForm 대신 전체 화면에 에러 안내가 표시된다. 닉네임 입력 자체가 불가능하다.
- **대응 방법**: "홈으로 돌아가기" 버튼을 클릭하여 홈에서 새 방을 만들거나, 유효한 초대 링크를 호스트에게 다시 받는다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (339-354번 라인)

---

## room.방_참가

### Validation 규칙

#### POL-004: 닉네임 공백 입력 차단
- **규칙**: 닉네임 입력란이 비어 있거나 공백만 입력된 경우 참여하기 버튼이 비활성화되며 참가 액션이 실행되지 않는다.
- **조건**: name.trim()이 빈 문자열인 경우
- **위반 시**: 버튼은 비활성(opacity-50, cursor-not-allowed) 상태이며 handleJoin() 호출 시 즉시 return.
- **비즈니스 배경**: 닉네임은 호스트 재접속 판별 시 이름 매칭에도 사용되므로 공백 닉네임은 허용되지 않는다.
- **코드 근거**: `components/poker/JoinRoomForm.tsx` (handleJoin, 38번 라인; 버튼 disabled, 82-83번 라인)

#### POL-005: 참가자 ID 자동 발급 — UUID v4
- **규칙**: 참가자가 방에 참가할 때 시스템이 자동으로 고유 ID(UUID v4)를 발급한다. 사용자가 직접 지정할 수 없다.
- **조건**: joinRoom() 호출 시 crypto.randomUUID()로 myId를 신규 발급
- **위반 시**: 해당 없음 (자동 생성).
- **코드 근거**: `store/usePokerStore.ts` (joinRoom, 119번 라인)

### 설정값

#### POL-006: 닉네임 localStorage 자동 캐싱
- **설정**: localStorage 키 = 'jira-joker-participant-name'
- **비즈니스 의미**: 참가자가 방에 입장할 때 입력한 닉네임을 브라우저에 저장하여, 다음 방 참가 시 자동 입력된다.
- **변경 시 영향**: 키 변경 시 기존 캐싱된 닉네임이 더 이상 자동 입력되지 않는다.
- **코드 근거**: `components/poker/JoinRoomForm.tsx` (PARTICIPANT_NAME_KEY, 12번 라인)

---

## room.대기_화면

### Validation 규칙

#### POL-007: 2인 미만 시 포커 게임 진입 차단
- **규칙**: 방의 참가자 수가 2명 미만이면 포커 테이블을 표시하지 않고 대기 화면을 보여준다.
- **조건**: participants.length < 2
- **위반 시**: 포커 테이블, 카드 덱이 렌더링되지 않으며 투표가 불가능하다.
- **비즈니스 배경**: Planning Poker는 최소 2명 이상이 있어야 의미 있는 추정이 가능하다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (409번 라인)

### 상태 정책

#### POL-008: 대기 화면 역할별 분기 표시
- **규칙**: 대기 화면에서 호스트와 참가자는 다른 UI를 본다.
- **전이**: 대기 화면(호스트용) ↔ 대기 화면(참가자용)
- **전이 조건**: isHost() 값에 따라 렌더링 분기. 호스트는 초대 링크 공유 UI, 참가자는 "호스트와 연결 중..." 표시
- **역전이**: 가능 — 역할이 바뀌면 (host_migrated) 다른 화면이 표시됨
- **영향**: 참가자 수가 2명 이상이 되면 두 화면 모두 포커 테이블로 자동 전환
- **코드 근거**: `app/room/[roomId]/page.tsx` (412-447번 라인)

### 설정값

#### POL-009: 초대 링크 복사 완료 피드백 지속 시간
- **설정**: copied 상태 유지 시간 = 2000ms (2초)
- **비즈니스 의미**: 클립보드 복사 완료 후 버튼 텍스트가 "복사됨!"으로 2초간 바뀌어 성공 여부를 시각적으로 알린다. 대기 화면과 JoinRoomForm 헤더 양쪽에 동일하게 적용된다.
- **변경 시 영향**: 대기 화면과 JoinRoomForm 두 곳의 타이머를 동시에 변경해야 한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (319번 라인), `components/poker/JoinRoomForm.tsx` (34번 라인)

---

## room.이탈_호스트

### Validation 규칙

#### POL-010: 호스트 방 종료 시 사용자 확인 필수
- **규칙**: 호스트가 "방 종료" 버튼을 클릭하면 반드시 확인 팝업이 표시되며, 취소하면 아무 동작도 하지 않는다.
- **조건**: isHost() === true이고 "방 종료" 버튼 클릭 시
- **위반 시**: window.confirm()에서 취소(false)를 선택하면 handleLeaveRoom()이 즉시 종료된다.
- **비즈니스 배경**: 호스트의 방 종료는 모든 참가자를 즉시 내보내는 되돌릴 수 없는 동작이므로 실수 방지를 위해 확인을 요구한다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (handleLeaveRoom, 300-302번 라인)

### 상태 정책

#### POL-011: 호스트 이탈 시 참가자 전체에게 방 종료 알림
- **규칙**: 호스트가 방 종료를 확인하면 모든 참가자에게 방 종료 메시지를 전송하고, 참가자는 "방이 종료되었습니다" 오버레이 화면으로 전환된다.
- **전이**: 정상 참가 상태 → 방 종료 오버레이 (disconnectReason = 'host_left')
- **전이 조건**: room_closed DataMessage 수신
- **역전이**: 불가 — 오버레이에서 홈으로 이동만 가능하며 방에 재진입할 수 없음
- **영향**: leaveRoom() 호출로 sessionStorage의 상태가 전부 초기화됨
- **코드 근거**: `app/room/[roomId]/page.tsx` (302번 라인, 152-153번 라인)

---

## room.이탈_참가자

### 상태 정책

#### POL-012: 참가자 능동 이탈 시 leaving 메시지 broadcast
- **규칙**: 참가자가 "나가기" 버튼을 클릭하면 다른 모든 참가자에게 이탈 사실을 알리는 메시지를 전송한다.
- **전이**: 참가 중 → 이탈 (broadcast 후 leaveRoom() + 홈 이동)
- **전이 조건**: isHost() === false이고 "나가기" 버튼 클릭
- **역전이**: 불가 — leaveRoom()으로 상태가 초기화되므로 같은 세션에 재입장 불가
- **영향**: 수신측 참가자들이 목록에서 이탈자를 제거하며, 전원 투표 완료 조건이 재계산된다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (304-309번 라인)

#### POL-013: leaving 메시지 중복 수신 방지
- **규칙**: leaving 메시지 수신 시 해당 참가자가 이미 목록에서 제거된 경우 중복 처리를 하지 않는다.
- **전이**: 해당 없음 (방어 규칙)
- **전이 조건**: participants.some(p => p.id === msg.peerId)가 false이면 즉시 무시
- **역전이**: 해당 없음
- **영향**: DataChannel leaving 메시지와 SSE peer_left 이벤트가 동시에 수신되어도 removeParticipant가 두 번 호출되지 않는다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (handleDataMessage leaving case, 169번 라인)

---

## room.호스트_재접속_보호

### 상태 정책

#### POL-014: 호스트 비자발적 이탈 시 무기한 대기 상태 전환
- **규칙**: 호스트의 연결이 예기치 않게 끊어지면 방을 종료하지 않고, 참가자들은 "호스트 재접속 대기 중" 오버레이를 표시하며 무기한 대기한다.
- **전이**: 정상 참가 중 → hostWaiting = true (재접속 대기 오버레이)
- **전이 조건**: onPeerDisconnected 콜백에서 끊어진 피어 ID === hostId인 경우
- **역전이**: 가능 — 호스트가 동일 이름으로 재접속하면 자동 복원됨 (POL-015)
- **영향**: hostWaiting 오버레이가 모든 화면을 가림(z-50). 참가자가 "홈으로 돌아가기"를 선택하면 leaveRoom() 실행
- **코드 근거**: `app/room/[roomId]/page.tsx` (onPeerDisconnected, 223-233번 라인)

#### POL-015: 호스트 재접속 판별 기준 — 닉네임 동일 매칭
- **규칙**: 재접속 대기 중 새로 연결된 참가자의 닉네임이 이탈한 호스트의 닉네임과 일치하면 해당 참가자를 호스트로 자동 복원한다.
- **전이**: hostWaiting = true → hostWaiting = false (호스트 복원 완료)
- **전이 조건**: hostWaiting === true이고 신규 연결 피어의 name === departedHostName
- **역전이**: 해당 없음 (복원 후 정상 상태)
- **영향**: migrateHost(peerId) 호출로 PokerState.hostId 갱신 + host_migrated DataMessage broadcast로 전체 동기화
- **코드 근거**: `app/room/[roomId]/page.tsx` (onPeerConnected, 208-221번 라인)

### 설정값

#### POL-016: 호스트 복원 broadcast 지연 시간
- **설정**: host_migrated broadcast 지연 = 500ms
- **비즈니스 의미**: 호스트 재접속이 확인된 즉시 broadcast하면 DataChannel이 아직 완전히 열리지 않아 메시지가 소실될 수 있다. 500ms 대기 후 전송하여 모든 참가자가 확실히 수신하게 한다.
- **변경 시 영향**: 값을 줄이면 메시지 소실 위험이 높아지고, 늘리면 호스트 복원 UI 업데이트가 지연된다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (218-220번 라인)

---

## room.참가자_추방

### 상태 정책

#### POL-017: kick 메시지 수신 시 대상/비대상 처리 분기
- **규칙**: 추방 메시지를 수신한 참가자는 메시지의 대상이 자신인지 여부에 따라 다르게 반응한다.
- **전이**:
  - 대상(targetId === myId): 정상 참가 중 → disconnectReason = 'kicked' (추방 오버레이)
  - 비대상(targetId !== myId): 해당 참가자를 목록에서 즉시 제거
- **전이 조건**: kick DataMessage 수신 및 targetId 비교
- **역전이**: 불가 — 추방된 참가자는 오버레이에서 홈으로만 이동 가능
- **영향**: 비대상 참가자들은 removeParticipant()로 목록 갱신 → 전원 투표 완료 조건 재계산
- **코드 근거**: `app/room/[roomId]/page.tsx` (handleDataMessage kick case, 155-161번 라인)

### 에러 시나리오

#### ERR-003: 방에서 추방됨
- **메시지**: "방에서 추방되었습니다" / "호스트에 의해 추방되었습니다."
- **발생 조건**: 호스트가 특정 참가자를 kick하고, 대상 참가자가 kick DataMessage를 수신한 경우
- **사용자 영향**: 전체 화면 오버레이(z-50)가 표시되어 이후 행동이 모두 차단된다.
- **대응 방법**: "홈으로 돌아가기" 버튼을 클릭하면 세션 상태가 초기화되고 홈으로 이동한다. 해당 방에는 재입장할 수 없다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (155-157번 라인, 382-403번 라인)

---

## room.beforeunload_이탈

### 상태 정책

#### POL-018: 호스트만 탭 닫기 시 브라우저 이탈 확인 표시
- **규칙**: 호스트가 탭을 닫거나 새로고침하려고 하면 브라우저 기본 이탈 확인 대화상자가 표시된다. 참가자는 별도 확인 없이 즉시 이탈된다.
- **전이**: 탭 닫기/새로고침 시도 → 호스트: 브라우저 confirm → 참가자: 즉시 이탈
- **전이 조건**: beforeunload 이벤트 발생 + isHost() 여부
- **역전이**: 가능 — 호스트가 확인 다이얼로그에서 취소 선택 시 이탈 취소
- **영향**: 호스트가 취소해도 sendBeacon은 이미 전송된 상태일 수 있음 (best-effort)
- **코드 근거**: `app/room/[roomId]/page.tsx` (beforeunload handler, 91-109번 라인)

#### POL-019: 탭 닫기 시 서버 + P2P 이중 이탈 알림
- **규칙**: 탭을 닫거나 새로고침할 때 서버(sendBeacon POST)와 다른 참가자(DataChannel)에게 동시에 이탈 사실을 알린다.
- **전이**: 연결 중 → 이탈 처리 (서버: peer_left 이벤트 발행, P2P: leaving 메시지 수신)
- **전이 조건**: beforeunload 이벤트 발생, myId와 storeRoomId가 존재
- **역전이**: 불가
- **영향**: 서버 측 SSE 피어 목록에서 제거(peer_left 이벤트 발행) + 다른 참가자의 participants 배열에서 제거
- **코드 근거**: `app/room/[roomId]/page.tsx` (96-105번 라인)

---

## room.방_종료_오버레이

### 상태 정책

#### POL-020: disconnectReason에 따른 오버레이 메시지 분기
- **규칙**: 방 종료 오버레이는 종료 원인에 따라 다른 제목과 내용을 표시한다.
- **전이**: 정상 참가 중 → 방 종료 오버레이 (disconnectReason 설정)
- **전이 조건**:
  - room_closed 수신 → disconnectReason = 'host_left' → 제목 "방이 종료되었습니다"
  - kick 수신(자신이 대상) → disconnectReason = 'kicked' → 제목 "방에서 추방되었습니다"
- **역전이**: 불가 — 오버레이에서 "홈으로 돌아가기" 클릭 시만 leaveRoom() 실행 후 홈 이동 가능
- **영향**: leaveRoom() 실행 시 sessionStorage의 모든 상태가 초기화됨
- **코드 근거**: `app/room/[roomId]/page.tsx` (380-403번 라인)

### 에러 시나리오

#### ERR-002: 방이 호스트에 의해 종료됨
- **메시지**: "방이 종료되었습니다" / "호스트가 방을 나갔습니다."
- **발생 조건**: 호스트가 방 종료를 확인하여 room_closed DataMessage가 참가자에게 전달된 경우
- **사용자 영향**: 전체 화면 오버레이(z-50)가 표시되어 포커 게임이 완전히 차단된다.
- **대응 방법**: "홈으로 돌아가기" 버튼 클릭 시 세션 상태가 초기화되고 홈으로 이동한다. 완료된 투표 내용은 세션 완료 화면에서 확인할 수 없게 된다.
- **코드 근거**: `app/room/[roomId]/page.tsx` (152-153번 라인, 382-403번 라인)

---

## room.초대_링크_공유

### 설정값

#### POL-021: signalingStore globalThis 패턴으로 방 데이터 보존
- **설정**: signalingStore 싱글톤 유지 방식 = globalThis 패턴
- **비즈니스 의미**: Next.js 개발 환경에서 모듈이 재평가되어도 rooms Map이 초기화되지 않아야 방 유효성 검사가 일관되게 동작한다.
- **변경 시 영향**: 이 패턴을 제거하면 HMR 시 방 정보가 초기화되어 모든 참가자의 연결이 끊어진다.
- **코드 근거**: `lib/signalingStore.ts` (globalForSignaling, 8-12번 라인)

#### POL-022: 마지막 참가자 이탈 시 방 항목 자동 삭제
- **설정**: room.size === 0이면 rooms.delete(roomId) 자동 실행
- **비즈니스 의미**: 모든 참가자가 나간 방은 서버 메모리에서 즉시 제거되어 해당 roomId에 대한 유효성 검사가 false를 반환한다.
- **변경 시 영향**: 이 자동 삭제를 제거하면 방이 종료된 후에도 새 참가자가 접근할 수 있게 된다.
- **코드 근거**: `lib/signalingStore.ts` (removePeer, 34번 라인)
