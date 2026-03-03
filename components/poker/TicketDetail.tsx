'use client'

import { useState } from 'react'

import { JiraTicket } from '@/store/usePokerStore'

interface TicketDetailProps {
  ticket: JiraTicket
  ticketIndex: number
  totalTickets: number
  collapsible?: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'text-red-600',
  High: 'text-red-500',
  Medium: 'text-orange-500',
  Low: 'text-blue-500',
  Lowest: 'text-blue-400',
}

export function TicketDetail({ ticket, ticketIndex, totalTickets, collapsible = false }: TicketDetailProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header: key + summary + progress */}
      <div
        className={`border-b border-gray-100 px-5 py-4 ${collapsible ? 'cursor-pointer lg:cursor-default' : ''}`}
        onClick={collapsible ? () => setIsExpanded((v) => !v) : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-semibold text-gray-700">
              {ticket.key}
            </span>
            {ticket.priority && (
              <span
                className={`text-sm font-medium ${PRIORITY_COLORS[ticket.priority.name] ?? 'text-gray-500'}`}
              >
                {ticket.priority.iconUrl ? (
                  <img
                    src={ticket.priority.iconUrl}
                    alt={ticket.priority.name}
                    className="mr-1 inline h-4 w-4"
                  />
                ) : null}
                {ticket.priority.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {ticketIndex + 1} / {totalTickets}
            </span>
            {collapsible && (
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform lg:hidden ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">{ticket.summary}</h2>
      </div>

      {/* Body: 2-column layout — collapsible on mobile */}
      <div className={collapsible && !isExpanded ? 'hidden lg:flex lg:flex-col lg:gap-0 md:flex-row' : 'flex flex-col gap-0 md:flex-row'}>
        {/* Left: description */}
        <div className="flex-1 border-b border-gray-100 px-5 py-4 md:border-r md:border-b-0">
          <p className="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">설명</p>
          {ticket.description ? (
            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {ticket.description}
            </div>
          ) : (
            <p className="text-sm text-gray-400">설명 없음</p>
          )}
        </div>

        {/* Right: details sidebar */}
        <div className="w-full space-y-3 px-5 py-4 md:w-56">
          <DetailRow label="담당자">
            {ticket.assignee ? (
              <div className="flex items-center gap-2">
                {ticket.assignee.avatarUrl && (
                  <img
                    src={ticket.assignee.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-900">{ticket.assignee.displayName}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">없음</span>
            )}
          </DetailRow>

          <DetailRow label="보고자">
            {ticket.reporter ? (
              <div className="flex items-center gap-2">
                {ticket.reporter.avatarUrl && (
                  <img
                    src={ticket.reporter.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-900">{ticket.reporter.displayName}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">없음</span>
            )}
          </DetailRow>

          <DetailRow label="우선순위">
            {ticket.priority ? (
              <div className="flex items-center gap-1.5">
                {ticket.priority.iconUrl && (
                  <img
                    src={ticket.priority.iconUrl}
                    alt=""
                    className="h-4 w-4"
                  />
                )}
                <span
                  className={`text-sm font-medium ${PRIORITY_COLORS[ticket.priority.name] ?? 'text-gray-700'}`}
                >
                  {ticket.priority.name}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">없음</span>
            )}
          </DetailRow>

          <DetailRow label="기한">
            {ticket.dueDate ? (
              <span className="text-sm text-gray-900">{ticket.dueDate}</span>
            ) : (
              <span className="text-sm text-gray-400">없음</span>
            )}
          </DetailRow>

          <DetailRow label="Story Points">
            {ticket.storyPoints !== undefined ? (
              <span className="text-sm font-medium text-gray-900">{ticket.storyPoints} SP</span>
            ) : (
              <span className="text-sm text-gray-400">없음</span>
            )}
          </DetailRow>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}
