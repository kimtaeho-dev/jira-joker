'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

export function CreateRoomWizard() {
  const router = useRouter()
  const createRoom = usePokerStore((s) => s.createRoom)

  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [authMode, setAuthMode] = useState<'cloud' | 'server'>('cloud')
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')

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
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 실패')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 → just advance
  const handleStep2Next = () => {
    setError('')
    if (!name.trim()) {
      setError('닉네임을 입력해주세요.')
      return
    }
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
    createRoom(name.trim(), jiraConfig, tickets)
    router.push('/room/' + crypto.randomUUID())
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Jira Joker</h1>
          <p className="mt-2 text-sm text-gray-500">Real-time Planning Poker via WebRTC P2P</p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : step > s
                      ? 'bg-blue-200 text-blue-700'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`h-px w-8 ${step > s ? 'bg-blue-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Jira 연동</h2>
                <p className="mt-1 text-sm text-gray-500">
                  인증 방식을 선택하고 정보를 입력해주세요.
                </p>
              </div>

              {/* Cloud / Server toggle */}
              <div className="flex rounded-xl border border-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('cloud')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    authMode === 'cloud'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Cloud
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('server')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    authMode === 'server'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Server · DC
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                {authMode === 'cloud' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Jira Account Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {authMode === 'cloud' ? 'API Token' : 'Personal Access Token'}
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1Next()}
                    placeholder="토큰을 입력하세요"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleStep1Next}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '인증 확인 중...' : '다음'}
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">닉네임 설정</h2>
                <p className="mt-1 text-sm text-gray-500">
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
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  이전
                </button>
                <button
                  onClick={handleStep2Next}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
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
                <h2 className="text-lg font-semibold text-gray-900">Epic 지정</h2>
                <p className="mt-1 text-sm text-gray-500">
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
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSearchEpic}
                  disabled={!epicKeyInput.trim() || searchingEpic}
                  className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {searchingEpic ? '검색 중...' : '검색'}
                </button>
              </div>

              {/* 에러 */}
              {epicError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">{epicError}</p>
                </div>
              )}

              {/* Epic 미리보기 */}
              {foundEpic && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-medium text-blue-500">Epic 확인</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">
                    <span className="text-blue-600">{foundEpic.key}</span> {foundEpic.summary}
                  </p>
                  <div className="mt-2 border-t border-blue-200 pt-2">
                    {tickets.length === 0 ? (
                      <p className="text-xs text-gray-400">하위 Task가 없습니다.</p>
                    ) : (
                      <>
                        <p className="mb-1.5 text-xs font-medium text-gray-500">
                          하위 Task {tickets.length}건
                        </p>
                        <ul className="space-y-1">
                          {tickets.slice(0, 5).map((t) => (
                            <li key={t.id} className="text-xs text-gray-700">
                              <span className="font-medium text-blue-600">{t.key}</span> {t.summary}
                            </li>
                          ))}
                          {tickets.length > 5 && (
                            <li className="text-xs text-gray-400">외 {tickets.length - 5}건</li>
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
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  이전
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={!foundEpic || tickets.length === 0}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
