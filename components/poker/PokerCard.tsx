'use client'

interface PokerCardProps {
  value: string
  isSelected?: boolean
  isRevealed?: boolean
  vote?: string
  disabled?: boolean
  compact?: boolean
  onClick?: () => void
}

export function PokerCard({
  value,
  isSelected = false,
  isRevealed = false,
  vote,
  disabled = false,
  compact = false,
  onClick,
}: PokerCardProps) {
  const displayValue = isRevealed && vote !== undefined ? vote : value

  const stateClasses = isSelected
    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25 scale-105 cursor-default'
    : disabled
      ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed opacity-50'
      : 'border-slate-200 bg-white text-slate-800 hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 cursor-pointer'

  const sizeClasses = compact
    ? 'h-14 w-10 text-base sm:h-16 sm:w-12 sm:text-lg'
    : 'h-20 w-14 text-xl'

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`flex flex-col items-center justify-center rounded-xl border-2 font-bold transition-all duration-200 ease-out select-none ${sizeClasses} ${stateClasses}`}
    >
      {displayValue}
    </button>
  )
}
