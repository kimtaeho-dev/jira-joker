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
  email?: string // Cloud: required / Server·DC: omitted
}

export interface JiraTicket {
  id: string
  key: string
  summary: string
  storyPoints?: number
}

export interface CompletedTicket {
  ticket: JiraTicket
  votes: Record<string, string>
  result: { mode: string; average: number }
}

interface PokerState {
  myId: string
  myName: string | null
  jiraConfig: JiraConfig | null
  tickets: JiraTicket[]
  phase: 'voting' | 'revealed'
  myVote: string | null
  participants: Participant[]
  currentTicketIndex: number
  completedTickets: CompletedTicket[]
  // Actions
  createRoom: (name: string, jiraConfig: JiraConfig, tickets: JiraTicket[]) => void
  joinRoom: (name: string) => void
  selectCard: (value: string) => void
  revealVotes: () => void
  resetRound: () => void
  nextTicket: () => void
  // Derived
  allVoted: () => boolean
  mode: () => string | null
  average: () => number | null
  currentTicket: () => JiraTicket | null
  isLastTicket: () => boolean
}

export const usePokerStore = create<PokerState>()((set, get) => ({
  myId: '',
  myName: null,
  jiraConfig: null,
  tickets: [],
  phase: 'voting',
  myVote: null,
  participants: [],
  currentTicketIndex: 0,
  completedTickets: [],

  createRoom: (name, jiraConfig, tickets) => {
    const myId = crypto.randomUUID()
    set({
      myId,
      myName: name,
      jiraConfig,
      tickets,
      phase: 'voting',
      myVote: null,
      currentTicketIndex: 0,
      completedTickets: [],
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
        p.id === state.myId ? { ...p, hasVoted: true } : p,
      ),
    })),

  revealVotes: () =>
    set((state) => ({
      phase: 'revealed',
      participants: state.participants.map((p) =>
        p.id === state.myId ? { ...p, vote: state.myVote ?? undefined } : p,
      ),
    })),

  resetRound: () =>
    set((state) => ({
      phase: 'voting',
      myVote: null,
      participants: state.participants.map((p) =>
        p.id === state.myId
          ? { id: p.id, name: p.name, hasVoted: false }
          : { ...p, hasVoted: true },
      ),
    })),

  nextTicket: () => {
    const state = get()
    const ticket = state.tickets[state.currentTicketIndex]
    if (!ticket) return

    const votes: Record<string, string> = {}
    for (const p of state.participants) {
      if (p.vote) votes[p.name] = p.vote
    }

    const modeValue = state.mode() ?? '?'
    const avgValue = state.average() ?? 0

    set({
      currentTicketIndex: state.currentTicketIndex + 1,
      completedTickets: [
        ...state.completedTickets,
        { ticket, votes, result: { mode: modeValue, average: avgValue } },
      ],
      phase: 'voting',
      myVote: null,
      participants: state.participants.map((p) => ({
        id: p.id,
        name: p.name,
        hasVoted: false,
      })),
    })
  },

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

  currentTicket: () => {
    const { tickets, currentTicketIndex } = get()
    return tickets[currentTicketIndex] ?? null
  },

  isLastTicket: () => {
    const { tickets, currentTicketIndex } = get()
    return currentTicketIndex >= tickets.length - 1
  },
}))
