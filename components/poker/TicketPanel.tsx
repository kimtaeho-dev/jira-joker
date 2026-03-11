'use client'

import { JiraTicket } from '@/store/usePokerStore'

import { TicketDetail } from './TicketDetail'
import { TicketHistory } from './TicketHistory'

interface TicketPanelProps {
  ticket: JiraTicket | null
  ticketIndex: number
  totalTickets: number
  isOpen: boolean
  onToggle: () => void
}

export function TicketPanel({ ticket, ticketIndex, totalTickets, isOpen, onToggle }: TicketPanelProps) {
  if (!ticket && totalTickets === 0) return null

  return (
    <>
      {/* Toggle button — always visible, attached to panel edge */}
      <button
        onClick={onToggle}
        className={`fixed top-20 z-40 flex h-10 w-10 items-center justify-center rounded-l-xl border border-r-0 border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:bg-slate-50 ${
          isOpen ? 'right-96' : 'right-0'
        }`}
        title={isOpen ? '패널 닫기' : '티켓 정보'}
      >
        {isOpen ? (
          <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed right-0 top-[57px] bottom-0 z-30 w-96 border-l border-slate-200/60 bg-white/90 shadow-lg backdrop-blur-md transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {/* Ticket Detail */}
          {ticket && (
            <div className="pb-4">
              <TicketDetail
                ticket={ticket}
                ticketIndex={ticketIndex}
                totalTickets={totalTickets}
              />
            </div>
          )}

          {/* Ticket History */}
          <div className="border-t border-slate-100 pt-4">
            <TicketHistory />
          </div>
        </div>
      </div>

      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  )
}
