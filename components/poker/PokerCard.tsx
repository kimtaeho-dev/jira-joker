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
    ? 'border-blue-600 bg-blue-600 text-white shadow-lg scale-110 cursor-default'
    : disabled
      ? 'border-gray-200 bg-white text-gray-300 cursor-not-allowed opacity-50'
      : 'border-gray-200 bg-white text-gray-800 hover:border-blue-400 hover:shadow-md cursor-pointer'

  const sizeClasses = compact
    ? 'h-14 w-10 text-base sm:h-16 sm:w-12 sm:text-lg'
    : 'h-20 w-14 text-xl'

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`flex flex-col items-center justify-center rounded-lg border-2 font-bold transition-all select-none ${sizeClasses} ${stateClasses}`}
    >
      {displayValue}
    </button>
  )
}
