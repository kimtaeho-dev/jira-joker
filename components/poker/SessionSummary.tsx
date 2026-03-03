'use client'

import type { CompletedTicket } from '@/store/usePokerStore'

interface SessionSummaryProps {
  completedTickets: CompletedTicket[]
  totalTickets: number
  onLeave: () => void
}

export function SessionSummary({ completedTickets, totalTickets, onLeave }: SessionSummaryProps) {
  const totalSP = completedTickets.reduce((sum, ct) => {
    const n = Number(ct.result.mode)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">세션 완료!</h2>
          <div className="mt-2 flex items-center justify-center gap-3 text-sm text-gray-500">
            <span>{totalTickets}개 티켓 추정 완료</span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="font-semibold text-gray-800">총 {totalSP} SP</span>
          </div>
        </div>

        {/* Table — desktop */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium tracking-wide text-gray-400 uppercase">
                <th className="px-6 py-3">Ticket</th>
                <th className="px-6 py-3">Summary</th>
                <th className="px-6 py-3 text-center">Mode</th>
                <th className="px-6 py-3 text-center">Average</th>
              </tr>
            </thead>
            <tbody>
              {completedTickets.map((ct, idx) => (
                <tr key={idx} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-6 py-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-600">
                      {ct.ticket.key}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-3 text-gray-800">{ct.ticket.summary}</td>
                  <td className="px-6 py-3 text-center font-semibold text-gray-900">{ct.result.mode}</td>
                  <td className="px-6 py-3 text-center font-semibold text-gray-900">{ct.result.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card list — mobile */}
        <div className="space-y-2 p-4 sm:hidden">
          {completedTickets.map((ct, idx) => (
            <div key={idx} className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-600">
                  {ct.ticket.key}
                </span>
                <span className="truncate text-sm text-gray-800">{ct.ticket.summary}</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-gray-500">
                  Mode: <span className="font-semibold text-gray-800">{ct.result.mode}</span>
                </span>
                <span className="text-gray-500">
                  Avg: <span className="font-semibold text-gray-800">{ct.result.average.toFixed(1)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-5 text-center">
          <button
            onClick={onLeave}
            className="rounded-lg bg-gray-900 px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            세션 종료
          </button>
        </div>
      </div>
    </div>
  )
}
