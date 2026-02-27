# Chapter 04: Jira REST API 프록시 설계

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app/api/jira/route.ts` | Jira REST API 프록시 엔드포인트 |
| `components/poker/CreateRoomWizard.tsx` | 방 생성 위자드 — Jira 인증 + Epic 검색 + 방 생성 |

---

## 1. API 프록시 패턴의 필요성

브라우저에서 Jira REST API를 직접 호출하면 두 가지 문제가 발생한다:

**CORS (Cross-Origin Resource Sharing):**
Jira 서버는 기본적으로 외부 도메인의 브라우저 요청을 차단한다. 프록시를 통해 **서버 간 통신**(Server-to-Server)으로 전환하면 CORS 제한이 적용되지 않는다.

**토큰 보안:**
브라우저의 네트워크 탭에서 요청 헤더를 확인할 수 있다. Jira API 토큰이 `Authorization` 헤더에 노출되면 보안 위험이 생긴다. 프록시를 사용하면 토큰은 **Next.js 서버 내부에서만** Jira 서버로 전달된다.

---

## 2. 아키텍처 다이어그램

```
브라우저 (클라이언트)              Next.js 서버                    Jira REST API
      │                              │                              │
      │── fetch('/api/jira')────────→│                              │
      │   Headers:                   │                              │
      │     X-Jira-Domain            │── fetch(jiraUrl) ───────────→│
      │     X-Jira-Email             │   Headers:                   │
      │     X-Jira-Token             │     Authorization: Basic/    │
      │                              │                   Bearer     │
      │                              │←── Jira 응답 ────────────────│
      │←── NextResponse.json() ──────│                              │
      │                              │                              │
```

**포인트:**
- 클라이언트 → 프록시: 커스텀 헤더(`X-Jira-*`)로 인증 정보 전달
- 프록시 → Jira: 표준 `Authorization` 헤더로 변환하여 전달
- Jira API 토큰은 서버 내부에서만 사용되며 브라우저 응답에 포함되지 않음

---

## 3. 이중 인증 체계

Jira는 배포 방식에 따라 인증 방법이 다르다:

```ts
// app/api/jira/route.ts:34-38
const authHeader = email
  ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
  : `Bearer ${token}`
const apiVersion = email ? '3' : '2'
const apiBase = `${baseUrl}/rest/api/${apiVersion}`
```

| 항목 | Jira Cloud | Jira Server / Data Center |
|------|-----------|--------------------------|
| 판별 기준 | `email` 헤더 존재 | `email` 헤더 미존재 |
| 인증 방식 | Basic Auth (`email:token` base64) | Bearer Token (PAT) |
| API 버전 | `/rest/api/3` | `/rest/api/2` |

**판별 로직:** `email` 필드의 유무로 자동 분기한다. Cloud는 API Token + email 조합이 필요하고, Server/DC는 Personal Access Token(PAT)만으로 인증한다.

인증 정보는 다음과 같이 요청 헤더에서 추출한다:

```ts
// app/api/jira/route.ts:14-19
function getCredentials(req: NextRequest) {
  const domain = req.headers.get('x-jira-domain')
  const token = req.headers.get('x-jira-token')
  const email = req.headers.get('x-jira-email')
  return { domain, token, email }
}
```

---

## 4. 엔드포인트별 구현

### 4.1 `type=myself` — 인증 검증 (L46-58)

```ts
// app/api/jira/route.ts:46-58
if (type === 'myself') {
  const url = `${apiBase}/myself`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json(
      { error: `인증 실패: ${res.status} ${body}` },
      { status: res.status },
    )
  }
  const data = await res.json()
  return NextResponse.json({ displayName: data.displayName })
}
```

CreateRoomWizard의 Step 1에서 사용한다. Jira의 `/myself` 엔드포인트를 호출하여 인증 정보가 유효한지 확인한다. 성공하면 사용자 이름을 반환한다.

### 4.2 `type=epic` — Epic 단건 조회 (L60-88)

```ts
// app/api/jira/route.ts:60-88
if (type === 'epic') {
  if (!epicKey) {
    return NextResponse.json({ error: 'epicKey is required' }, { status: 400 })
  }
  const url = `${apiBase}/issue/${epicKey}?fields=summary,key,issuetype`
  const res = await fetch(url, { headers })
  if (res.status === 404) {
    return NextResponse.json({ error: `Epic을 찾을 수 없습니다: ${epicKey}` }, { status: 404 })
  }
  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json(
      { error: `Jira error: ${res.status} ${body}` },
      { status: res.status },
    )
  }
  const data = await res.json()
  if (data.fields?.issuetype?.name !== '에픽') {
    return NextResponse.json(
      {
        error: `${epicKey}는 Epic 타입이 아닙니다 (${data.fields?.issuetype?.name ?? 'Unknown'})`,
      },
      { status: 400 },
    )
  }
  return NextResponse.json({
    epic: { id: data.id, key: data.key, summary: data.fields.summary },
  })
}
```

Epic 키(예: `PROJ-42`)로 이슈를 조회한 뒤, `issuetype.name`이 '에픽'인지 검증한다. Epic이 아닌 일반 이슈가 입력되면 에러를 반환하여 잘못된 대상으로 Planning Poker가 진행되는 것을 방지한다.

### 4.3 `type=issues` — 하위 이슈 검색 (L90-161)

```ts
// app/api/jira/route.ts:90-112
if (type === 'issues') {
  // ...
  const url = `${apiBase}/search/jql`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql: `parent = ${epicKey} ORDER BY created DESC`,
      fields: [
        'summary',
        'key',
        'customfield_10016',
        'description',
        'assignee',
        'reporter',
        'duedate',
        'priority',
      ],
      maxResults: 100,
    }),
  })
```

JQL(Jira Query Language)로 Epic의 하위 이슈를 검색한다.

**`customfield_10016`:** Jira Cloud에서 Story Points 필드의 ID다. Jira는 Story Points를 커스텀 필드로 관리하며, Cloud 기본값이 `customfield_10016`이다.

**ADF(Atlassian Document Format) 파싱:**

```ts
// app/api/jira/route.ts:5-12
function extractAdfText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) {
    return node.content.map(extractAdfText).join(node.type === 'paragraph' ? '\n' : '')
  }
  return ''
}
```

Jira Cloud API v3는 description을 ADF(JSON 트리 구조)로 반환한다. 이 재귀 함수가 트리를 순회하며 순수 텍스트를 추출한다. Server/DC API v2는 일반 텍스트/HTML로 반환하므로 별도 파싱 없이 `String()`으로 변환한다:

```ts
// app/api/jira/route.ts:127-134
if (f.description) {
  if (isCloud && typeof f.description === 'object') {
    description = extractAdfText(f.description)
  } else {
    description = String(f.description)
  }
}
```

---

## 5. 클라이언트 호출 패턴

CreateRoomWizard에서 제네릭 유틸 함수로 Jira API를 호출한다:

```ts
// components/poker/CreateRoomWizard.tsx:16-31
async function fetchFromJira<T>(
  type: string,
  config: JiraConfig,
  extra?: Record<string, string>,
): Promise<T> {
  const params = new URLSearchParams({ type, ...extra })
  const reqHeaders: Record<string, string> = {
    'x-jira-domain': config.domain,
    'x-jira-token': config.token,
  }
  if (config.email) reqHeaders['x-jira-email'] = config.email
  const res = await fetch(`/api/jira?${params}`, { headers: reqHeaders })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}
```

**설계 포인트:**

1. **제네릭 `<T>`:** 호출부에서 반환 타입을 지정하여 타입 안전성 확보
   ```ts
   await fetchFromJira<{ displayName: string }>('myself', jiraConfig)
   await fetchFromJira<{ epic: JiraEpic }>('epic', jiraConfig, { epicKey: key })
   await fetchFromJira<{ issues: JiraTicket[] }>('issues', jiraConfig, { epicKey: key })
   ```

2. **인증 정보는 헤더로 전달:** URL 쿼리 파라미터가 아닌 `X-Jira-*` 커스텀 헤더로 전달하여 서버 로그나 브라우저 히스토리에 토큰이 남지 않도록 한다

3. **에러 전파:** `!res.ok`이면 서버가 반환한 에러 메시지를 `Error`로 던져 호출부에서 catch로 처리

---

## 6. 인증 정보 캐싱 — localStorage vs sessionStorage 역할 분리

이 프로젝트는 두 가지 브라우저 스토리지를 다른 목적으로 사용한다:

| 스토리지 | 키 | 내용 | 수명 |
|----------|-----|------|------|
| **localStorage** | `jira-joker-credentials` | Jira 도메인, 이메일, 토큰, 인증 모드 | 브라우저 종료 후에도 유지 |
| **sessionStorage** | `poker-room` | 방 ID, 참가자, 투표 상태 등 전체 게임 상태 | 탭 종료 시 삭제 |

**localStorage 캐싱 (CreateRoomWizard):**

```ts
// components/poker/CreateRoomWizard.tsx:33, 49-61, 94-99
const JIRA_CREDS_KEY = 'jira-joker-credentials'

// 로드
useEffect(() => {
  try {
    const saved = localStorage.getItem(JIRA_CREDS_KEY)
    if (saved) {
      const creds = JSON.parse(saved)
      if (creds.authMode) setAuthMode(creds.authMode)
      if (creds.domain) setDomain(creds.domain)
      if (creds.email) setEmail(creds.email)
      if (creds.token) setToken(creds.token)
      setHasSavedCreds(true)
    }
  } catch {}
}, [])

// 저장 (인증 성공 시)
try {
  localStorage.setItem(JIRA_CREDS_KEY, JSON.stringify({
    authMode, domain: domain.trim(), email: email.trim(), token: token.trim(),
  }))
  setHasSavedCreds(true)
} catch {}
```

사용자가 매번 Jira 인증 정보를 입력하지 않아도 되도록 localStorage에 캐싱한다. 인증 성공 후 저장하고, 다음 방 생성 시 자동으로 로드한다. "저장된 인증 정보 삭제" 버튼으로 수동 삭제도 가능하다.

**sessionStorage (Zustand persist):**

게임 상태는 sessionStorage에 저장된다. 새로고침(F5)해도 방에서 쫓겨나지 않지만, 탭을 닫으면 자동으로 상태가 삭제된다. 이는 Planning Poker의 세션 특성에 맞는 선택이다 — 같은 탭에서는 유지, 탭 종료 시 정리.

---

## Key Takeaways

- **API 프록시는 CORS 해결 + 토큰 보안** 두 가지를 동시에 달성한다
- **이중 인증 체계:** `email` 유무로 Cloud(Basic)/Server(Bearer)를 자동 판별 — 사용자가 인증 방식을 몰라도 됨
- **`customfield_10016`:** Jira Cloud의 Story Points 필드 ID — 시스템마다 다를 수 있으므로 설정 가능하게 만드는 것이 이상적
- **ADF 재귀 파싱:** Cloud v3의 복잡한 문서 형식을 순수 텍스트로 변환하는 경량 유틸리티
- **스토리지 역할 분리:** 인증 정보는 localStorage(장기), 게임 상태는 sessionStorage(세션) — 수명에 맞는 스토리지 선택이 UX를 결정
