'use client'

import { use } from 'react'

import { CardDeck } from '@/components/poker/CardDeck'
import { JoinRoomForm } from '@/components/poker/JoinRoomForm'
import { PlayerList } from '@/components/poker/PlayerList'
import { VoteResults } from '@/components/poker/VoteResults'
import { usePokerStore } from '@/store/usePokerStore'

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)

  const myName = usePokerStore((s) => s.myName)
  const revealVotes = usePokerStore((s) => s.revealVotes)
  const allVoted = usePokerStore((s) => s.allVoted)
  const phase = usePokerStore((s) => s.phase)
  const currentTicket = usePokerStore((s) => s.currentTicket)

  if (!myName) {
    return <JoinRoomForm roomId={roomId} />
  }

  const canReveal = phase === 'voting' && allVoted()

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
        {currentTicket && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
              Current Ticket
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{currentTicket}</h2>
          </div>
        )}

        <section>
          <h3 className="mb-4 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Participants
          </h3>
          <PlayerList />
        </section>

        <section>
          <h3 className="mb-4 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Your Vote
          </h3>
          <CardDeck />
        </section>

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
      </main>
    </div>
  )
}
