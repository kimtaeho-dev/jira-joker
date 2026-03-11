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
        <span className="rounded-lg bg-primary-soft px-2 py-0.5 font-mono text-sm font-semibold text-primary">
          {ticket.key}
        </span>
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
          {ticketIndex + 1} / {totalTickets}
        </span>
      </div>
      <h2 className="mt-2 text-sm font-semibold text-text-primary leading-snug">{ticket.summary}</h2>

      {/* Description */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        {ticket.description ? (
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
            {ticket.description}
          </div>
        ) : (
          <p className="text-xs text-text-muted">설명 없음</p>
        )}
      </div>
    </div>
  )
}
