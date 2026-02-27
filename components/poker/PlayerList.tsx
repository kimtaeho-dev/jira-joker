'use client'

import { usePokerStore } from '@/store/usePokerStore'

interface PlayerListProps {
  onKick?: (participantId: string) => void
  isHost?: boolean
  myId?: string
}

export function PlayerList({ onKick, isHost, myId }: PlayerListProps) {
  const participants = usePokerStore((s) => s.participants)
  const phase = usePokerStore((s) => s.phase)
  const hostId = usePokerStore((s) => s.hostId)

  const isRevealed = phase === 'revealed'

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {participants.map((participant) => (
        <div key={participant.id} className="flex flex-col items-center gap-2">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-600">
            {participant.name[0].toUpperCase()}
            {participant.id === hostId && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px]" title="Host">
                ★
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">{participant.name}</span>
          <div
            className={[
              'flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all',
              isRevealed && participant.vote
                ? 'border-blue-600 bg-blue-600 text-white'
                : participant.hasVoted
                  ? 'border-green-500 bg-green-50 text-green-600'
                  : 'border-gray-200 bg-gray-50 text-gray-400',
            ].join(' ')}
          >
            {isRevealed && participant.vote ? participant.vote : participant.hasVoted ? '✓' : '…'}
          </div>
          {isHost && onKick && participant.id !== myId && (
            <button
              onClick={() => onKick(participant.id)}
              className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="추방"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
