'use client'

import { usePokerStore } from '@/store/usePokerStore'

interface VoteResultsProps {
  onReset?: () => void
  onNext?: () => void
  isHost?: boolean
}

export function VoteResults({ onReset, onNext, isHost = true }: VoteResultsProps) {
  const phase = usePokerStore((s) => s.phase)
  const resetRound = usePokerStore((s) => s.resetRound)
  const nextTicket = usePokerStore((s) => s.nextTicket)
  const isLastTicket = usePokerStore((s) => s.isLastTicket)
  const mode = usePokerStore((s) => s.mode)
  const average = usePokerStore((s) => s.average)

  if (phase !== 'revealed') return null

  const modeValue = mode()
  const avgValue = average()
  const lastTicket = isLastTicket()

  const handleReset = onReset ?? resetRound
  const handleNext = onNext ?? nextTicket

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-center text-lg font-semibold text-gray-900">Results</h3>
      <div className="flex justify-center gap-10">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium tracking-wide text-gray-500 uppercase">Mode</span>
          <span className="text-4xl font-bold text-gray-900">{modeValue ?? '—'}</span>
        </div>
        <div className="w-px self-stretch bg-gray-200" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium tracking-wide text-gray-500 uppercase">Average</span>
          <span className="text-4xl font-bold text-gray-900">
            {avgValue !== null ? avgValue.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {!isHost && (
          <p className="text-center text-xs text-gray-400">호스트만 다음 단계를 진행할 수 있습니다</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={!isHost}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Re-vote
          </button>
          {lastTicket ? (
            <span className="flex flex-1 items-center justify-center rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              All Tickets Done
            </span>
          ) : (
            <button
              onClick={handleNext}
              disabled={!isHost}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next Ticket →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
