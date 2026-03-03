'use client'

import { useState } from 'react'

import { usePokerStore } from '@/store/usePokerStore'

export function TicketHistory() {
  const completedTickets = usePokerStore((s) => s.completedTickets)
  const tickets = usePokerStore((s) => s.tickets)
  const currentTicketIndex = usePokerStore((s) => s.currentTicketIndex)
  const [isOpen, setIsOpen] = useState(false)

  if (completedTickets.length === 0) return null

  const remaining = tickets.length - currentTicketIndex
  const hasRemaining = remaining > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Planning History
          </h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {completedTickets.length} done
          </span>
          {hasRemaining && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {remaining} left
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3">
          <ul className="space-y-3">
            {completedTickets.map((ct, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-mono font-semibold text-gray-600">
                      {ct.ticket.key}
                    </span>
                    <span className="truncate text-sm text-gray-800">{ct.ticket.summary}</span>
                  </div>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-gray-500">
                    Mode: <span className="font-semibold text-gray-800">{ct.result.mode}</span>
                  </span>
                  <span className="text-gray-500">
                    Avg: <span className="font-semibold text-gray-800">{ct.result.average.toFixed(1)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
