'use client'

import { useRouter } from 'next/navigation'
import { use, useCallback, useEffect, useRef, useState } from 'react'

import { CardDeck } from '@/components/poker/CardDeck'
import { JoinRoomForm } from '@/components/poker/JoinRoomForm'
import { PokerTable } from '@/components/poker/PokerTable'
import { SessionSummary } from '@/components/poker/SessionSummary'
import { TicketPanel } from '@/components/poker/TicketPanel'
import type { DataMessage } from '@/hooks/useWebRTC'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useHydration } from '@/store/useHydration'
import { usePokerStore } from '@/store/usePokerStore'

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const router = useRouter()
  const hydrated = useHydration()

  const myName = usePokerStore((s) => s.myName)
  const myId = usePokerStore((s) => s.myId)
  const myVote = usePokerStore((s) => s.myVote)
  const storeRoomId = usePokerStore((s) => s.roomId)
  const revealVotes = usePokerStore((s) => s.revealVotes)
  const selectCard = usePokerStore((s) => s.selectCard)
  const resetRound = usePokerStore((s) => s.resetRound)
  const nextTicket = usePokerStore((s) => s.nextTicket)
  const participants = usePokerStore((s) => s.participants)
  const phase = usePokerStore((s) => s.phase)
  const currentTicket = usePokerStore((s) => s.currentTicket)
  const currentTicketIndex = usePokerStore((s) => s.currentTicketIndex)
  const tickets = usePokerStore((s) => s.tickets)
  const addParticipant = usePokerStore((s) => s.addParticipant)
  const removeParticipant = usePokerStore((s) => s.removeParticipant)
  const setParticipantVoted = usePokerStore((s) => s.setParticipantVoted)
  const setParticipantVote = usePokerStore((s) => s.setParticipantVote)
  const applySyncState = usePokerStore((s) => s.applySyncState)
  const completedTickets = usePokerStore((s) => s.completedTickets)
  const isHost = usePokerStore((s) => s.isHost)
  const leaveRoom = usePokerStore((s) => s.leaveRoom)
  const migrateHost = usePokerStore((s) => s.migrateHost)

  const [roomValid, setRoomValid] = useState<boolean | null>(null)
  const [disconnectReason, setDisconnectReason] = useState<'host_left' | 'kicked' | null>(null)
  const [hostWaiting, setHostWaiting] = useState(false)
  const [departedHostName, setDepartedHostName] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const myVoteRef = useRef(myVote)
  useEffect(() => { myVoteRef.current = myVote }, [myVote])

  const hostId = usePokerStore((s) => s.hostId)

  const storeRef = useRef({
    participants,
    tickets,
    currentTicketIndex,
    phase,
    completedTickets: usePokerStore.getState().completedTickets,
    hostId,
  })
  useEffect(() => {
    storeRef.current = {
      participants,
      tickets,
      currentTicketIndex,
      phase,
      completedTickets: usePokerStore.getState().completedTickets,
      hostId,
    }
  }, [participants, tickets, currentTicketIndex, phase, hostId])

  // Room 유효성 검사: 새 참가자 경로일 때만 서버에 확인
  useEffect(() => {
    if (!hydrated) return
    if (myName && storeRoomId === roomId) {
      setRoomValid(true)
      return
    }
    fetch(`/api/room/${roomId}`)
      .then((res) => res.json())
      .then((data: { exists: boolean }) => setRoomValid(data.exists))
      .catch(() => setRoomValid(false))
  }, [hydrated, myName, storeRoomId, roomId])

  // beforeunload: 호스트 confirm dialog + 전체 참가자 즉시 이탈 알림
  useEffect(() => {
    if (!myId || !storeRoomId) return
    const handler = (e: BeforeUnloadEvent) => {
      if (isHost()) e.preventDefault() // 호스트만 confirm dialog
      // 서버에 즉시 알림 (sendBeacon — 탭 닫힘에도 작동)
      try {
        navigator.sendBeacon(
          `/api/signaling/${storeRoomId}`,
          new Blob([JSON.stringify({ from: myId, type: 'leave' })], { type: 'application/json' })
        )
      } catch {}
      // DataChannel로도 즉시 알림 (best-effort)
      try { broadcastRef.current({ type: 'leaving', peerId: myId }) } catch {}
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [myId, storeRoomId, isHost])

  const isAllVoted =
    phase === 'voting' &&
    participants.length >= 2 &&
    participants.every((p) => p.hasVoted)
  const [countdown, setCountdown] = useState<number | null>(null)

  // broadcast ref: WebRTC 초기화 전에도 안전하게 참조할 수 있도록
  const broadcastRef = useRef<(msg: DataMessage) => void>(() => {})
  const sendToPeerRef = useRef<(peerId: string, msg: DataMessage) => void>(() => {})

  const handleDataMessage = useCallback(
    (msg: DataMessage) => {
      switch (msg.type) {
        case 'voted':
          setParticipantVoted(msg.from)
          break
        case 'reveal':
          setParticipantVote(msg.from, msg.vote)
          break
        case 'reset':
          resetRound()
          break
        case 'next':
          nextTicket()
          break
        case 'sync_request': {
          const s = storeRef.current
          sendToPeerRef.current(msg.from, {
            type: 'sync_response',
            state: {
              participants: s.participants,
              tickets: s.tickets,
              currentTicketIndex: s.currentTicketIndex,
              phase: s.phase,
              completedTickets: s.completedTickets,
              hostId: s.hostId,
            },
          })
          break
        }
        case 'sync_response':
          applySyncState(msg.state)
          break
        case 'room_closed':
          setDisconnectReason('host_left')
          break
        case 'kick':
          if (msg.targetId === usePokerStore.getState().myId) {
            setDisconnectReason('kicked')
          } else {
            removeParticipant(msg.targetId)
          }
          break
        case 'host_migrated':
          migrateHost(msg.newHostId)
          setHostWaiting(false)
          setDepartedHostName(null)
          break
        case 'leaving': {
          const state = usePokerStore.getState()
          if (!state.participants.some((p) => p.id === msg.peerId)) return
          const departedPeer = state.participants.find((p) => p.id === msg.peerId)
          removeParticipant(msg.peerId)
          if (msg.peerId === state.hostId) {
            setDepartedHostName(departedPeer?.name ?? null)
            setHostWaiting(true)
          }
          break
        }
      }
    },
    [setParticipantVoted, setParticipantVote, resetRound, nextTicket, applySyncState, removeParticipant, migrateHost],
  )

  const departedHostNameRef = useRef(departedHostName)
  useEffect(() => { departedHostNameRef.current = departedHostName }, [departedHostName])
  const hostWaitingRef = useRef(hostWaiting)
  useEffect(() => { hostWaitingRef.current = hostWaiting }, [hostWaiting])

  const { broadcast, sendToPeer } = useWebRTC({
    roomId,
    myId,
    myName: myName ?? '',
    enabled: !!myName && storeRoomId === roomId,
    onMessage: handleDataMessage,
    onPeerConnected: (peerId, name) => {
      addParticipant({ id: peerId, name, hasVoted: false })
      // 호스트 대기 중 → 이름 매칭으로 호스트 복원
      if (hostWaitingRef.current && departedHostNameRef.current && name === departedHostNameRef.current) {
        migrateHost(peerId)
        setHostWaiting(false)
        setDepartedHostName(null)
        // 다른 참가자들에게도 호스트 변경 알림
        setTimeout(() => {
          broadcastRef.current({ type: 'host_migrated', newHostId: peerId })
        }, 500)
      }
    },
    onPeerDisconnected: (peerId) => {
      const state = usePokerStore.getState()
      // 이미 제거된 피어는 무시 (peer_left + onconnectionstatechange 중복 호출 방어)
      if (!state.participants.some((p) => p.id === peerId)) return
      const departedPeer = state.participants.find((p) => p.id === peerId)
      removeParticipant(peerId)

      if (peerId === state.hostId) {
        setDepartedHostName(departedPeer?.name ?? null)
        setHostWaiting(true)
      }
    },
  })

  // broadcast/sendToPeer ref 업데이트
  useEffect(() => { broadcastRef.current = broadcast }, [broadcast])
  useEffect(() => { sendToPeerRef.current = sendToPeer }, [sendToPeer])

  // Effect 1: 카운트다운 타이머만 관리
  useEffect(() => {
    if (!isAllVoted) {
      setCountdown(null)
      return
    }
    setCountdown(2)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isAllVoted])

  // Effect 2: countdown===0 감지 → reveal 실행
  useEffect(() => {
    if (countdown === 0) {
      revealVotes()
      broadcastRef.current({ type: 'reveal', from: myId, vote: myVoteRef.current ?? '?' })
      setCountdown(null)
    }
  }, [countdown, revealVotes, myId])

  const handleSelectCard = useCallback(
    (value: string) => {
      selectCard(value)
      broadcastRef.current({ type: 'voted', from: myId })
    },
    [selectCard, myId],
  )

  const handleReset = useCallback(() => {
    resetRound()
    broadcastRef.current({ type: 'reset' })
  }, [resetRound])

  const handleNext = useCallback(() => {
    nextTicket()
    broadcastRef.current({ type: 'next' })
  }, [nextTicket])

  const handleKick = useCallback((targetId: string) => {
    broadcastRef.current({ type: 'kick', targetId })
    removeParticipant(targetId)
  }, [removeParticipant])

  const handleLeaveRoom = useCallback(() => {
    if (isHost()) {
      if (!window.confirm('방을 종료하시겠습니까?\n모든 참가자의 연결이 끊어집니다.')) return
      broadcastRef.current({ type: 'room_closed' })
    } else {
      try { broadcastRef.current({ type: 'leaving', peerId: myId }) } catch {}
    }
    leaveRoom()
    router.push('/')
  }, [leaveRoom, router, isHost, myId])

  // 클립보드 복사
  const [copied, setCopied] = useState(false)
  const inviteUrl = typeof window !== 'undefined' ? window.location.href : ''

  const handleCopyInvite = useCallback(() => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [inviteUrl])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!myName || storeRoomId !== roomId) {
    if (roomValid === null) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      )
    }
    if (roomValid === false) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">방을 찾을 수 없습니다</h2>
            <p className="mt-2 text-gray-500">존재하지 않거나 이미 종료된 방입니다.</p>
          </div>
          <a
            href="/"
            className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            홈으로 돌아가기
          </a>
        </div>
      )
    }
    return <JoinRoomForm roomId={roomId} />
  }

  // 호스트 재접속 대기 오버레이
  if (hostWaiting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">호스트 재접속 대기 중...</h2>
          <p className="mt-2 text-sm text-gray-500">호스트가 돌아오면 자동으로 복원됩니다</p>
          <button
            onClick={() => {
              leaveRoom()
              router.push('/')
            }}
            className="mt-6 rounded-lg bg-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // disconnectReason overlay (호스트 이탈 / 추방)
  if (disconnectReason) {
    const title = disconnectReason === 'host_left' ? '방이 종료되었습니다' : '방에서 추방되었습니다'
    const desc = disconnectReason === 'host_left' ? '호스트가 방을 나갔습니다.' : '호스트에 의해 추방되었습니다.'
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-2 text-sm text-gray-500">{desc}</p>
          <button
            onClick={() => {
              leaveRoom()
              router.push('/')
            }}
            className="mt-6 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const ticket = currentTicket()

  // 2인 미만 대기 화면
  if (participants.length < 2) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-6">
        {isHost() ? (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">게임 준비 중</h2>
              <p className="mt-2 text-gray-500">다른 참가자를 기다리는 중입니다...</p>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-700">초대 링크를 공유하세요</p>
              <div className="flex w-full items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 outline-none"
                />
                <button
                  onClick={handleCopyInvite}
                  className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-700"
                >
                  {copied ? '복사됨!' : '복사'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">호스트와 연결 중...</h2>
              <p className="mt-2 text-gray-500">곧 게임이 시작됩니다</p>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-500">
              Room: {roomId.slice(0, 8)}…
            </span>
          </>
        )}
      </div>
    )
  }

  // 세션 완료 화면
  if (!ticket && tickets.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-xl font-bold text-gray-900">Jira Joker</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                  {myName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 sm:inline">{myName}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <SessionSummary
            completedTickets={completedTickets}
            totalTickets={tickets.length}
            onLeave={handleLeaveRoom}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          {/* Left: Title */}
          <span className="text-xl font-bold text-gray-900">Jira Joker</span>

          {/* Center: Room ID + Copy */}
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-500">
              {roomId.slice(0, 8)}…
            </span>
            <button
              onClick={handleCopyInvite}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              {copied ? '복사됨!' : '링크 복사'}
            </button>
          </div>

          {/* Right: User profile + Leave */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                {myName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 sm:inline">{myName}</span>
            </div>
            <button
              onClick={handleLeaveRoom}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isHost()
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200'
              }`}
            >
              {isHost() ? '방 종료' : '나가기'}
            </button>
          </div>
        </div>
      </header>

      {/* Main: Poker Table (center) */}
      <main className={`flex flex-1 items-center justify-center px-4 transition-[padding] duration-300 ${panelOpen ? 'lg:pr-96' : ''}`}>
        <PokerTable
          myId={myId}
          countdown={countdown}
          onReset={handleReset}
          onNext={handleNext}
          onKick={handleKick}
        />
      </main>

      {/* Bottom: Card Deck (sticky) */}
      {ticket && (
        <div className={`sticky bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur transition-[padding] duration-300 ${panelOpen ? 'lg:pr-96' : ''}`}>
          <CardDeck onSelectCard={handleSelectCard} compact />
        </div>
      )}

      {/* Floating: Ticket Panel (right) */}
      <TicketPanel
        ticket={ticket}
        ticketIndex={currentTicketIndex}
        totalTickets={tickets.length}
        isOpen={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
      />
    </div>
  )
}
