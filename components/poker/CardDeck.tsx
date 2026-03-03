'use client'

import { usePokerStore } from '@/store/usePokerStore'

import { PokerCard } from './PokerCard'

export const CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕']

interface CardDeckProps {
  onSelectCard?: (value: string) => void
  compact?: boolean
}

export function CardDeck({ onSelectCard, compact = false }: CardDeckProps = {}) {
  const myVote = usePokerStore((s) => s.myVote)
  const phase = usePokerStore((s) => s.phase)
  const selectCard = usePokerStore((s) => s.selectCard)

  const isRevealed = phase === 'revealed'

  const handleClick = (value: string) => {
    if (onSelectCard) {
      onSelectCard(value)
    } else {
      selectCard(value)
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
      {CARD_VALUES.map((value) => (
        <PokerCard
          key={value}
          value={value}
          isSelected={myVote === value}
          isRevealed={isRevealed}
          vote={myVote ?? undefined}
          disabled={isRevealed}
          compact={compact}
          onClick={isRevealed ? undefined : () => handleClick(value)}
        />
      ))}
    </div>
  )
}
