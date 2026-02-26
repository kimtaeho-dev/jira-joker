'use client'

import { usePokerStore } from '@/store/usePokerStore'

export function VoteResults() {
  const phase = usePokerStore((s) => s.phase)
  const resetRound = usePokerStore((s) => s.resetRound)
  const mode = usePokerStore((s) => s.mode)
  const average = usePokerStore((s) => s.average)

  if (phase !== 'revealed') return null

  const modeValue = mode()
  const avgValue = average()

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-center text-lg font-semibold text-gray-900">Results</h3>
      <div className="flex justify-center gap-10">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Mode</span>
          <span className="text-4xl font-bold text-gray-900">{modeValue ?? '—'}</span>
        </div>
        <div className="w-px self-stretch bg-gray-200" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Average</span>
          <span className="text-4xl font-bold text-gray-900">
            {avgValue !== null ? avgValue.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      <button
        onClick={resetRound}
        className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Reset Round
      </button>
    </div>
  )
}
