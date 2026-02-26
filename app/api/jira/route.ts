import { NextRequest, NextResponse } from 'next/server'

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
        return NextResponse.json({ error: `인증 실패: ${res.status} ${body}` }, { status: res.status })
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
        return NextResponse.json({ error: `Jira error: ${res.status} ${body}` }, { status: res.status })
      }
      const data = await res.json()

      console.log('epic data', data);
      
      if (data.fields?.issuetype?.name !== '에픽') {
        return NextResponse.json(
          { error: `${epicKey}는 에픽 타입이 아닙니다 (${data.fields?.issuetype?.name ?? 'Unknown'})` },
          { status: 400 }
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
      const jqlBase = email
        ? `parent = ${epicKey}`
        : `"Epic Link" = ${epicKey} AND issuetype in (Story, Task, Bug)`
      const jql = encodeURIComponent(`${jqlBase} ORDER BY created DESC`)
      const searchPath = email ? 'search/jql' : 'search'
      const url = `${apiBase}/${searchPath}?jql=${jql}&fields=summary,key,customfield_10016&maxResults=100`
      const res = await fetch(url, { headers })
      if (!res.ok) {
        const body = await res.text()
        return NextResponse.json({ error: `Jira error: ${res.status} ${body}` }, { status: res.status })
      }
      const data = await res.json()
      const issues = (data.issues ?? []).map((issue: { id: string; key: string; fields: { summary: string; customfield_10016?: number } }) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        storyPoints: issue.fields.customfield_10016 ?? undefined,
      }))
      return NextResponse.json({ issues })
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
