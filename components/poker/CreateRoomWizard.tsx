'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Logo } from '@/components/Logo'
import { JiraConfig, JiraTicket,usePokerStore } from '@/store/usePokerStore'

interface JiraEpic {
  id: string
  key: string
  summary: string
}

type Step = 1 | 2 | 3

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

const JIRA_CREDS_KEY = 'jira-joker-credentials'

export function CreateRoomWizard() {
  const router = useRouter()
  const createRoom = usePokerStore((s) => s.createRoom)

  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [authMode, setAuthMode] = useState<'cloud' | 'server'>('cloud')
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [hasSavedCreds, setHasSavedCreds] = useState(false)

  // localStorage에서 저장된 인증 정보 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(JIRA_CREDS_KEY)
      if (saved) {
        const creds = JSON.parse(saved)
        if (creds.authMode) setAuthMode(creds.authMode)
        if (creds.domain) setDomain(creds.domain)
        if (creds.email) setEmail(creds.email)
        if (creds.token) setToken(creds.token)
        if (creds.name) setName(creds.name)
        setHasSavedCreds(true)
      }
    } catch {}
  }, [])

  // Step 2
  const [name, setName] = useState('')

  // Step 3
  const [epicKeyInput, setEpicKeyInput] = useState('')
  const [foundEpic, setFoundEpic] = useState<JiraEpic | null>(null)
  const [tickets, setTickets] = useState<JiraTicket[]>([])
  const [searchingEpic, setSearchingEpic] = useState(false)
  const [epicError, setEpicError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const jiraConfig: JiraConfig = {
    domain: domain.trim(),
    token: token.trim(),
    ...(authMode === 'cloud' ? { email: email.trim() } : {}),
  }

  // Step 1 → validate credentials via /myself
  const handleStep1Next = async () => {
    setError('')
    const cloudInvalid = authMode === 'cloud' && (!domain.trim() || !email.trim() || !token.trim())
    const serverInvalid = authMode === 'server' && (!domain.trim() || !token.trim())
    if (cloudInvalid || serverInvalid) {
      setError('모든 필드를 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      await fetchFromJira<{ displayName: string }>('myself', jiraConfig)
      try {
        localStorage.setItem(JIRA_CREDS_KEY, JSON.stringify({
          authMode, domain: domain.trim(), email: email.trim(), token: token.trim(),
        }))
        setHasSavedCreds(true)
      } catch {}
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 실패')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 → just advance + 닉네임 localStorage 저장
  const handleStep2Next = () => {
    setError('')
    if (!name.trim()) {
      setError('닉네임을 입력해주세요.')
      return
    }
    try {
      const saved = localStorage.getItem(JIRA_CREDS_KEY)
      if (saved) {
        const creds = JSON.parse(saved)
        localStorage.setItem(JIRA_CREDS_KEY, JSON.stringify({ ...creds, name: name.trim() }))
      }
    } catch {}
    setStep(3)
  }

  // Step 3 — epic ID 검색
  const handleSearchEpic = async () => {
    const key = epicKeyInput.trim()
    if (!key) return
    setEpicError('')
    setFoundEpic(null)
    setTickets([])
    setSearchingEpic(true)
    try {
      const epicData = await fetchFromJira<{ epic: JiraEpic }>('epic', jiraConfig, { epicKey: key })
      const issueData = await fetchFromJira<{ issues: JiraTicket[] }>('issues', jiraConfig, {
        epicKey: key,
      })
      setFoundEpic(epicData.epic)
      setTickets(issueData.issues)
    } catch (err) {
      setEpicError(err instanceof Error ? err.message : 'Epic 검색 실패')
    } finally {
      setSearchingEpic(false)
    }
  }

  // Step 3 — epic key input 변경 시 결과 초기화
  const handleEpicKeyChange = (value: string) => {
    setEpicKeyInput(value)
    setFoundEpic(null)
    setTickets([])
    setEpicError('')
  }

  // Step 3 — 방 만들기
  const handleCreateRoom = () => {
    if (!foundEpic || tickets.length === 0) return
    const roomId = createRoom(name.trim(), jiraConfig, tickets)
    router.push('/room/' + roomId)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-text-secondary">Real-time Planning Poker via WebRTC P2P</p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                  step === s
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : step > s
                      ? 'bg-primary-light text-primary'
                      : 'bg-slate-100 text-text-muted'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`h-px w-8 transition-colors ${step > s ? 'bg-primary/40' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Jira 연동</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  인증 방식을 선택하고 정보를 입력해주세요.
                </p>
              </div>

              {/* Cloud / Server toggle */}
              <div className="flex rounded-xl border border-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('cloud')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    authMode === 'cloud'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Cloud
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('server')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    authMode === 'server'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Server · DC
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {authMode === 'cloud' ? 'Jira Domain' : 'Jira Base URL'}
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder={
                      authMode === 'cloud'
                        ? 'your-org.atlassian.net'
                        : 'https://jira.your-company.com'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                {authMode === 'cloud' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Jira Account Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {authMode === 'cloud' ? 'API Token' : 'Personal Access Token'}
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1Next()}
                    placeholder="토큰을 입력하세요"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                onClick={handleStep1Next}
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '인증 확인 중...' : '다음'}
              </button>
              {hasSavedCreds && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(JIRA_CREDS_KEY)
                    setDomain('')
                    setEmail('')
                    setToken('')
                    setAuthMode('cloud')
                    setHasSavedCreds(false)
                  }}
                  className="w-full text-center text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  저장된 인증 정보 삭제
                </button>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">닉네임 설정</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Planning Poker에서 사용할 이름을 입력해주세요.
                </p>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStep2Next()}
                placeholder="홍길동"
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  이전
                </button>
                <button
                  onClick={handleStep2Next}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Epic 지정</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Planning Poker 대상 Epic ID를 입력해주세요.
                </p>
              </div>

              {/* Epic ID 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={epicKeyInput}
                  onChange={(e) => handleEpicKeyChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchEpic()}
                  placeholder="PROJ-42"
                  autoFocus
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <button
                  onClick={handleSearchEpic}
                  disabled={!epicKeyInput.trim() || searchingEpic}
                  className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {searchingEpic ? '검색 중...' : '검색'}
                </button>
              </div>

              {/* 에러 */}
              {epicError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-danger">{epicError}</p>
                </div>
              )}

              {/* Epic 미리보기 */}
              {foundEpic && (
                <div className="rounded-xl border border-indigo-200 bg-primary-soft px-4 py-3">
                  <p className="text-xs font-medium text-primary">Epic 확인</p>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary">
                    <span className="text-primary">{foundEpic.key}</span> {foundEpic.summary}
                  </p>
                  <div className="mt-2 border-t border-indigo-200 pt-2">
                    {tickets.length === 0 ? (
                      <p className="text-xs text-text-muted">하위 Task가 없습니다.</p>
                    ) : (
                      <>
                        <p className="mb-1.5 text-xs font-medium text-text-secondary">
                          하위 Task {tickets.length}건
                        </p>
                        <ul className="space-y-1">
                          {tickets.slice(0, 5).map((t) => (
                            <li key={t.id} className="text-xs text-slate-700">
                              <span className="font-medium text-primary">{t.key}</span> {t.summary}
                            </li>
                          ))}
                          {tickets.length > 5 && (
                            <li className="text-xs text-text-muted">외 {tickets.length - 5}건</li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  이전
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={!foundEpic || tickets.length === 0}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  방 만들기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
