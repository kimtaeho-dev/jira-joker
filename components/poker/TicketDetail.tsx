'use client'

import { JiraTicket } from '@/store/usePokerStore'

interface TicketDetailProps {
  ticket: JiraTicket
  ticketIndex: number
  totalTickets: number
}

export function TicketDetail({ ticket, ticketIndex, totalTickets }: TicketDetailProps) {
  return (
    <div>
      {/* Header: key + progress */}
      <div className="flex items-center justify-between">
        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-semibold text-gray-700">
          {ticket.key}
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {ticketIndex + 1} / {totalTickets}
        </span>
      </div>
      <h2 className="mt-2 text-sm font-semibold text-gray-900 leading-snug">{ticket.summary}</h2>

      {/* Description */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        {ticket.description ? (
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
            {ticket.description}
          </div>
        ) : (
          <p className="text-xs text-gray-400">설명 없음</p>
        )}
      </div>
    </div>
  )
}
