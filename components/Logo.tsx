'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const sizes = {
  sm: { icon: 28, text: 'text-lg', gap: 'gap-2' },
  md: { icon: 36, text: 'text-2xl', gap: 'gap-2.5' },
  lg: { icon: 48, text: 'text-4xl', gap: 'gap-3' },
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const s = sizes[size]

  return (
    <div className={`flex items-center ${s.gap}`}>
      {/* Spade icon with "J" */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Spade shape */}
        <path
          d="M24 4C24 4 8 18 8 28C8 33.5 12 37 16.5 37C19.5 37 22 35.5 24 33C26 35.5 28.5 37 31.5 37C36 37 40 33.5 40 28C40 18 24 4 24 4Z"
          fill="var(--primary)"
        />
        {/* Stem */}
        <path
          d="M22 33L20 44H28L26 33"
          fill="var(--primary)"
        />
        {/* Letter J */}
        <text
          x="24"
          y="27"
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize="16"
          fontWeight="800"
          fontFamily="var(--font-plus-jakarta), system-ui, sans-serif"
        >
          J
        </text>
      </svg>

      {showText && (
        <span className={`font-display ${s.text} tracking-tight`}>
          <span className="font-medium text-text-primary">Jira</span>
          {' '}
          <span className="font-extrabold text-primary">Joker</span>
        </span>
      )}
    </div>
  )
}
