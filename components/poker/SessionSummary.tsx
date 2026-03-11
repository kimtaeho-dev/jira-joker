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
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-sm">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-6 text-center">
          <h2 className="font-display text-2xl font-bold text-text-primary">세션 완료!</h2>
          <div className="mt-2 flex items-center justify-center gap-3 text-sm text-text-secondary">
            <span>{totalTickets}개 티켓 추정 완료</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="font-semibold text-text-primary">총 {totalSP} SP</span>
          </div>
        </div>

        {/* Table — desktop */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium tracking-wide text-text-muted uppercase">
                <th className="px-6 py-3">Ticket</th>
                <th className="px-6 py-3">Summary</th>
                <th className="px-6 py-3 text-center">Mode</th>
                <th className="px-6 py-3 text-center">Average</th>
              </tr>
            </thead>
            <tbody>
              {completedTickets.map((ct, idx) => (
                <tr key={idx} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-6 py-3">
                    <span className="rounded-lg bg-primary-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                      {ct.ticket.key}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-3 text-slate-800">{ct.ticket.summary}</td>
                  <td className="px-6 py-3 text-center font-semibold text-text-primary">{ct.result.mode}</td>
                  <td className="px-6 py-3 text-center font-semibold text-text-primary">{ct.result.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card list — mobile */}
        <div className="space-y-2 p-4 sm:hidden">
          {completedTickets.map((ct, idx) => (
            <div key={idx} className="rounded-xl bg-surface-secondary px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                  {ct.ticket.key}
                </span>
                <span className="truncate text-sm text-slate-800">{ct.ticket.summary}</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-text-secondary">
                  Mode: <span className="font-semibold text-text-primary">{ct.result.mode}</span>
                </span>
                <span className="text-text-secondary">
                  Avg: <span className="font-semibold text-text-primary">{ct.result.average.toFixed(1)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-5 text-center">
          <button
            onClick={onLeave}
            className="rounded-xl bg-primary px-8 py-2.5 text-sm font-medium text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
          >
            세션 종료
          </button>
        </div>
      </div>
    </div>
  )
}
