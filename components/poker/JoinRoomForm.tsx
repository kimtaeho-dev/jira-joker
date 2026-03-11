'use client'

import { useEffect, useState } from 'react'

import { Logo } from '@/components/Logo'
import { usePokerStore } from '@/store/usePokerStore'

interface JoinRoomFormProps {
  roomId: string
}

const PARTICIPANT_NAME_KEY = 'jira-joker-participant-name'

export function JoinRoomForm({ roomId }: JoinRoomFormProps) {
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)
  const joinRoom = usePokerStore((s) => s.joinRoom)

  useEffect(() => {
    try {
      const cached = localStorage.getItem(PARTICIPANT_NAME_KEY)
      if (cached) setName(cached)
    } catch {
      // SSR or private mode
    }
  }, [])

  const roomUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : `/room/${roomId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = () => {
    if (!name.trim()) return
    try {
      localStorage.setItem(PARTICIPANT_NAME_KEY, name.trim())
    } catch {
      // SSR or private mode
    }
    joinRoom(name.trim(), roomId)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center">
          <Logo size="md" />
          <p className="mt-3 text-sm text-text-secondary">Enter your name to join the planning session</p>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">Room Link</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex-1 truncate rounded-xl bg-surface-secondary px-3 py-2 text-sm text-slate-700">
              {roomUrl}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Your name"
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={!name.trim()}
            className="w-full rounded-xl bg-primary px-8 py-3 text-base font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            참여하기
          </button>
        </div>
      </div>
    </div>
  )
}
