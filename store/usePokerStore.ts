import { create } from 'zustand'

export interface Participant {
  id: string
  name: string
  hasVoted: boolean
  vote?: string
}

export interface JiraConfig {
  domain: string
  token: string
  email?: string   // Cloud: required / Server·DC: omitted
}

export interface JiraTicket {
  id: string
  key: string
  summary: string
  storyPoints?: number
}

interface PokerState {
  myId: string
  myName: string | null
  jiraConfig: JiraConfig | null
  tickets: JiraTicket[]
  phase: 'voting' | 'revealed'
  myVote: string | null
  participants: Participant[]
  currentTicket: string | null
  // Actions
  createRoom: (name: string, jiraConfig: JiraConfig, tickets: JiraTicket[]) => void
  joinRoom: (name: string) => void
  selectCard: (value: string) => void
  revealVotes: () => void
  resetRound: () => void
  setCurrentTicket: (title: string) => void
  // Derived
  allVoted: () => boolean
  mode: () => string | null
  average: () => number | null
}

export const usePokerStore = create<PokerState>()((set, get) => ({
  myId: '',
  myName: null,
  jiraConfig: null,
  tickets: [],
  phase: 'voting',
  myVote: null,
  participants: [],
  currentTicket: null,

  createRoom: (name, jiraConfig, tickets) => {
    const myId = crypto.randomUUID()
    set({
      myId,
      myName: name,
      jiraConfig,
      tickets,
      phase: 'voting',
      myVote: null,
      currentTicket: tickets[0] ? `${tickets[0].key}: ${tickets[0].summary}` : null,
      participants: [{ id: myId, name, hasVoted: false }],
    })
  },

  joinRoom: (name) => {
    const myId = crypto.randomUUID()
    set((state) => ({
      myId,
      myName: name,
      phase: 'voting',
      myVote: null,
      participants: [...state.participants, { id: myId, name, hasVoted: false }],
    }))
  },

  selectCard: (value) =>
    set((state) => ({
      myVote: value,
      participants: state.participants.map((p) =>
        p.id === state.myId ? { ...p, hasVoted: true } : p
      ),
    })),

  revealVotes: () =>
    set((state) => ({
      phase: 'revealed',
      participants: state.participants.map((p) =>
        p.id === state.myId ? { ...p, vote: state.myVote ?? undefined } : p
      ),
    })),

  resetRound: () =>
    set((state) => ({
      phase: 'voting',
      myVote: null,
      participants: state.participants.map((p) =>
        p.id === state.myId
          ? { id: p.id, name: p.name, hasVoted: false }
          : { ...p, hasVoted: true }
      ),
    })),

  setCurrentTicket: (title) => set({ currentTicket: title }),

  allVoted: () => {
    const { participants } = get()
    return participants.length > 0 && participants.every((p) => p.hasVoted)
  },

  mode: () => {
    const votes = get()
      .participants.filter((p) => p.vote !== undefined)
      .map((p) => p.vote!)
    if (votes.length === 0) return null
    const freq: Record<string, number> = {}
    let maxCount = 0
    let modeValue: string | null = null
    for (const v of votes) {
      freq[v] = (freq[v] ?? 0) + 1
      if (freq[v] > maxCount) {
        maxCount = freq[v]
        modeValue = v
      }
    }
    return modeValue
  },

  average: () => {
    const numeric = get()
      .participants.filter((p) => p.vote !== undefined && !isNaN(Number(p.vote)))
      .map((p) => Number(p.vote!))
    if (numeric.length === 0) return null
    return numeric.reduce((a, b) => a + b, 0) / numeric.length
  },
}))
