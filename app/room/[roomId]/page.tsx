'use client'

import { use, useEffect, useState } from 'react'

import { CardDeck } from '@/components/poker/CardDeck'
import { JoinRoomForm } from '@/components/poker/JoinRoomForm'
import { PlayerList } from '@/components/poker/PlayerList'
import { TicketDetail } from '@/components/poker/TicketDetail'
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

  const isAllVoted = phase === 'voting' && allVoted()
  const ticket = currentTicket()

  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (!isAllVoted) {
      setCountdown(null)
      return
    }
    setCountdown(2)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          revealVotes()
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isAllVoted, revealVotes])

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
          <TicketDetail
            ticket={ticket}
            ticketIndex={currentTicketIndex}
            totalTickets={tickets.length}
          />
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

        {countdown !== null && (
          <div className="flex justify-center">
            <div className="rounded-xl bg-blue-50 px-8 py-3 text-center">
              <p className="text-sm font-medium text-blue-600">모든 참가자가 투표를 완료했습니다</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{countdown}초 후 결과 공개</p>
            </div>
          </div>
        )}

        <VoteResults />

        <TicketHistory />
      </main>
    </div>
  )
}
