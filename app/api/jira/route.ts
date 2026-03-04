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

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const epicKey = searchParams.get('epicKey')

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
      const url = email ? `${apiBase}/search/jql` : `${apiBase}/search`
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
