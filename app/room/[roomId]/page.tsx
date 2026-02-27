'use client'

import { use } from 'react'

import { CardDeck } from '@/components/poker/CardDeck'
import { JoinRoomForm } from '@/components/poker/JoinRoomForm'
import { PlayerList } from '@/components/poker/PlayerList'
import { TicketHistory } from '@/components/poker/TicketHistory'
import { VoteResults } from '@/components/poker/VoteResults'
import { useHydration } from '@/store/useHydration'
import { usePokerStore } from '@/store/usePokerStore'

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const hydrated = useHydration()

  const myName = usePokerStore((s) => s.myName)
  const storeRoomId = usePokerStore((s) => s.roomId)
  const revealVotes = usePokerStore((s) => s.revealVotes)
  const allVoted = usePokerStore((s) => s.allVoted)
  const phase = usePokerStore((s) => s.phase)
  const currentTicket = usePokerStore((s) => s.currentTicket)
  const currentTicketIndex = usePokerStore((s) => s.currentTicketIndex)
  const tickets = usePokerStore((s) => s.tickets)

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!myName || storeRoomId !== roomId) {
    return <JoinRoomForm roomId={roomId} />
  }

  const canReveal = phase === 'voting' && allVoted()
  const ticket = currentTicket()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-xl font-bold text-gray-900">Jira Joker</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
            Room: {roomId}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        {ticket ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Current Ticket
              </p>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {currentTicketIndex + 1} / {tickets.length}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-sm font-mono font-semibold text-gray-700">
                {ticket.key}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">{ticket.summary}</h2>
            </div>
            {ticket.storyPoints !== undefined && (
              <p className="mt-1 text-sm text-gray-500">
                Existing estimate: <span className="font-medium text-gray-700">{ticket.storyPoints} SP</span>
              </p>
            )}
          </div>
        ) : tickets.length > 0 ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm text-center">
            <p className="text-lg font-semibold text-green-800">All tickets completed!</p>
            <p className="mt-1 text-sm text-green-600">{tickets.length} tickets estimated</p>
          </div>
        ) : null}

        <section>
          <h3 className="mb-4 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Participants
          </h3>
          <PlayerList />
        </section>

        {ticket && (
          <section>
            <h3 className="mb-4 text-xs font-medium tracking-wide text-gray-500 uppercase">
              Your Vote
            </h3>
            <CardDeck />
          </section>
        )}

        {canReveal && (
          <div className="flex justify-center">
            <button
              onClick={revealVotes}
              className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Reveal Votes
            </button>
          </div>
        )}

        <VoteResults />

        <TicketHistory />
      </main>
    </div>
  )
}
