'use client'

import { usePokerStore } from '@/store/usePokerStore'

interface PokerTableProps {
  myId: string
  countdown: number | null
  onReset: () => void
  onNext: () => void
  onKick: (id: string) => void
}

function getPositions(total: number, myIdx: number) {
  return Array.from({ length: total }, (_, i) => {
    const offset = (i - myIdx + total) % total
    // "나"가 하단 중앙(270°=3π/2), 나머지 시계방향 배치
    const angle = Math.PI / 2 - (2 * Math.PI * offset) / total
    return {
      left: `${50 + 42 * Math.cos(angle)}%`,
      top: `${50 - 40 * Math.sin(angle)}%`,
    }
  })
}

export function PokerTable({ myId, countdown, onReset, onNext, onKick }: PokerTableProps) {
  const participants = usePokerStore((s) => s.participants)
  const phase = usePokerStore((s) => s.phase)
  const hostId = usePokerStore((s) => s.hostId)
  const isHost = usePokerStore((s) => s.isHost)
  const mode = usePokerStore((s) => s.mode)
  const average = usePokerStore((s) => s.average)
  const isLastTicket = usePokerStore((s) => s.isLastTicket)

  const isRevealed = phase === 'revealed'
  const amHost = isHost()
  const myIdx = participants.findIndex((p) => p.id === myId)
  const positions = getPositions(participants.length, myIdx)

  const modeValue = mode()
  const avgValue = average()
  const lastTicket = isLastTicket()

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(600px,85vh)]">
      {/* Table surface — green felt ellipse */}
      <div className="absolute left-1/2 top-1/2 h-[45%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-xl ring-4 ring-emerald-800/30 ring-offset-2 ring-offset-emerald-900/10">
        {/* Inner border for depth */}
        <div className="absolute inset-2 rounded-full border border-emerald-500/30" />

        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <TableCenter
            phase={phase}
            countdown={countdown}
            modeValue={modeValue}
            avgValue={avgValue}
            lastTicket={lastTicket}
            isHost={amHost}
            onReset={onReset}
            onNext={onNext}
          />
        </div>
      </div>

      {/* Participant seats */}
      {participants.map((participant, i) => {
        const pos = positions[i]
        const isMe = participant.id === myId
        const isHostPlayer = participant.id === hostId
        return (
          <div
            key={participant.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.left, top: pos.top }}
          >
            <Seat
              name={participant.name}
              hasVoted={participant.hasVoted}
              vote={participant.vote}
              isRevealed={isRevealed}
              isMe={isMe}
              isHostPlayer={isHostPlayer}
              canKick={amHost && !isMe}
              onKick={() => onKick(participant.id)}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ── Seat ── */

interface SeatProps {
  name: string
  hasVoted: boolean
  vote?: string
  isRevealed: boolean
  isMe: boolean
  isHostPlayer: boolean
  canKick: boolean
  onKick: () => void
}

function Seat({ name, hasVoted, vote, isRevealed, isMe, isHostPlayer, canKick, onKick }: SeatProps) {
  return (
    <div className="group flex flex-col items-center gap-1">
      {/* Name */}
      <span
        className={`max-w-[72px] truncate text-[11px] font-medium leading-tight ${
          isMe ? 'text-blue-600' : 'text-gray-600'
        }`}
      >
        {name}
      </span>

      {/* Avatar */}
      <div className="relative">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold sm:h-10 sm:w-10 ${
            isMe
              ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </div>
        {isHostPlayer && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px]">
            ★
          </span>
        )}
        {/* Kick button */}
        {canKick && (
          <button
            onClick={onKick}
            className="absolute -top-1 -left-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white group-hover:flex"
            title="추방"
          >
            ✕
          </button>
        )}
      </div>

      {/* Vote card */}
      <div
        className={`flex h-8 w-7 items-center justify-center rounded border-2 text-xs font-bold transition-all sm:h-9 sm:w-8 sm:text-sm ${
          isRevealed && vote
            ? 'border-blue-600 bg-blue-600 text-white'
            : hasVoted
              ? 'border-green-500 bg-green-50 text-green-600'
              : 'border-gray-200 bg-gray-50 text-gray-400'
        }`}
      >
        {isRevealed && vote ? vote : hasVoted ? '✓' : '…'}
      </div>
    </div>
  )
}

/* ── Table Center ── */

interface TableCenterProps {
  phase: 'voting' | 'revealed'
  countdown: number | null
  modeValue: string | null
  avgValue: number | null
  lastTicket: boolean
  isHost: boolean
  onReset: () => void
  onNext: () => void
}

function TableCenter({ phase, countdown, modeValue, avgValue, lastTicket, isHost, onReset, onNext }: TableCenterProps) {
  // Countdown
  if (countdown !== null && countdown > 0) {
    return (
      <div className="text-center">
        <p className="text-xs font-medium text-emerald-100">결과 공개까지</p>
        <p className="mt-1 text-4xl font-black text-white">{countdown}</p>
      </div>
    )
  }

  // Revealed results
  if (phase === 'revealed') {
    return (
      <div className="flex flex-col items-center gap-2 px-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[10px] font-medium tracking-wide text-emerald-200 uppercase">Mode</p>
            <p className="text-2xl font-black text-white sm:text-3xl">{modeValue ?? '—'}</p>
          </div>
          <div className="h-8 w-px bg-emerald-400/40" />
          <div className="text-center">
            <p className="text-[10px] font-medium tracking-wide text-emerald-200 uppercase">Avg</p>
            <p className="text-2xl font-black text-white sm:text-3xl">
              {avgValue !== null ? avgValue.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {isHost ? (
          <div className="mt-1 flex gap-2">
            <button
              onClick={onReset}
              className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/30"
            >
              Re-vote
            </button>
            {lastTicket ? (
              <span className="rounded-full bg-green-400/30 px-3 py-1 text-[11px] font-semibold text-green-100">
                All Done
              </span>
            ) : (
              <button
                onClick={onNext}
                className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-white"
              >
                Next →
              </button>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-emerald-200">호스트만 진행 가능</p>
        )}
      </div>
    )
  }

  // Voting in progress
  return (
    <p className="text-xs font-medium text-emerald-100/80">투표를 진행해주세요</p>
  )
}
