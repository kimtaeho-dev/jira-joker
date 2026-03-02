import { NextRequest, NextResponse } from 'next/server'

// Extract plain text from Jira Cloud ADF (Atlassian Document Format)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAdfText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) {
    return node.content.map(extractAdfText).join(node.type === 'paragraph' ? '\n' : '')
  }
  return ''
}

// SSRF 방지: 프라이빗 IP / 내부 주소 차단
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (lower === 'localhost' || lower === '[::1]') return true

  // IPv4 검사
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number)
    if (a === 127) return true                       // 127.0.0.0/8
    if (a === 10) return true                        // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true          // 192.168.0.0/16
    if (a === 169 && b === 254) return true          // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 0) return true                         // 0.0.0.0/8
  }

  return false
}

function validateDomain(domain: string): string | null {
  try {
    const urlStr = domain.startsWith('http') ? domain : `https://${domain}`
    const url = new URL(urlStr)
    if (isPrivateHost(url.hostname)) {
      return 'Jira 도메인이 프라이빗 네트워크 주소입니다'
    }
    return null
  } catch {
    return '유효하지 않은 Jira 도메인입니다'
  }
}

// JQL Injection 방지: Jira issue key 포맷 검증
const JIRA_KEY_PATTERN = /^[A-Z][A-Z0-9_]+-\d+$/

function getCredentials(req: NextRequest) {
  const domain = req.headers.get('x-jira-domain')
  const token = req.headers.get('x-jira-token')
  const email = req.headers.get('x-jira-email')
  return { domain, token, email }
}

export async function GET(req: NextRequest) {
  const { domain, token, email } = getCredentials(req)

  if (!domain || !token) {
    return NextResponse.json({ error: 'Missing Jira credentials' }, { status: 400 })
  }

  const domainError = validateDomain(domain)
  if (domainError) {
    return NextResponse.json({ error: domainError }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const epicKey = searchParams.get('epicKey')

  if (epicKey && !JIRA_KEY_PATTERN.test(epicKey)) {
    return NextResponse.json(
      { error: '유효하지 않은 Jira issue key 형식입니다' },
      { status: 400 },
    )
  }

  const baseUrl = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}`

  const authHeader = email
    ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    : `Bearer ${token}`
  const apiVersion = email ? '3' : '2'
  const apiBase = `${baseUrl}/rest/api/${apiVersion}`

  const headers = {
    Authorization: authHeader,
    Accept: 'application/json',
  }

  try {
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

    if (type === 'issues') {
      if (!epicKey) {
        return NextResponse.json({ error: 'epicKey is required' }, { status: 400 })
      }
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
      if (!res.ok) {
        const body = await res.text()
        return NextResponse.json(
          { error: `Jira error: ${res.status} ${body}` },
          { status: res.status },
        )
      }
      const data = await res.json()
      const isCloud = !!email
      const issues = (data.issues ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (issue: { id: string; key: string; fields: Record<string, any> }) => {
          const f = issue.fields
          // Cloud v3: description is ADF object; Server v2: plain text/HTML
          let description: string | null = null
          if (f.description) {
            if (isCloud && typeof f.description === 'object') {
              description = extractAdfText(f.description)
            } else {
              description = String(f.description)
            }
          }
          return {
            id: issue.id,
            key: issue.key,
            summary: f.summary,
            storyPoints: f.customfield_10016 ?? undefined,
            description,
            assignee: f.assignee
              ? {
                  displayName: f.assignee.displayName,
                  avatarUrl: f.assignee.avatarUrls?.['24x24'] ?? undefined,
                }
              : null,
            reporter: f.reporter
              ? {
                  displayName: f.reporter.displayName,
                  avatarUrl: f.reporter.avatarUrls?.['24x24'] ?? undefined,
                }
              : null,
            dueDate: f.duedate ?? null,
            priority: f.priority
              ? { name: f.priority.name, iconUrl: f.priority.iconUrl ?? undefined }
              : null,
          }
        },
      )
      return NextResponse.json({ issues })
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
