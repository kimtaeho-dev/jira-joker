'use client'

import { useEffect, useState } from 'react'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Join Room</h1>
          <p className="mt-2 text-sm text-gray-500">Enter your name to join the planning session</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Room Link</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {roomUrl}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
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
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={!name.trim()}
            className="w-full rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            참여하기
          </button>
        </div>
      </div>
    </div>
  )
}
