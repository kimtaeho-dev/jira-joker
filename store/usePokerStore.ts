import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
  description?: string | null
  assignee?: { displayName: string; avatarUrl?: string } | null
  reporter?: { displayName: string; avatarUrl?: string } | null
  dueDate?: string | null
  priority?: { name: string; iconUrl?: string } | null
}

export interface CompletedTicket {
  ticket: JiraTicket
  votes: Record<string, string>
  result: { mode: string; average: number }
}

export interface SyncState {
  participants: Participant[]
  tickets: JiraTicket[]
  currentTicketIndex: number
  phase: 'voting' | 'revealed'
  completedTickets: CompletedTicket[]
}

interface PokerState {
  roomId: string | null
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
  createRoom: (name: string, jiraConfig: JiraConfig, tickets: JiraTicket[]) => string
  joinRoom: (name: string, roomId: string) => void
  leaveRoom: () => void
  selectCard: (value: string) => void
  revealVotes: () => void
  resetRound: () => void
  nextTicket: () => void
  // Multi-peer actions
  addParticipant: (p: Participant) => void
  removeParticipant: (id: string) => void
  setParticipantVoted: (id: string) => void
  setParticipantVote: (id: string, vote: string) => void
  applySyncState: (state: SyncState) => void
  // Derived
  allVoted: () => boolean
  mode: () => string | null
  average: () => number | null
  currentTicket: () => JiraTicket | null
  isLastTicket: () => boolean
}

const initialState = {
  roomId: null as string | null,
  myId: '',
  myName: null as string | null,
  jiraConfig: null as JiraConfig | null,
  tickets: [] as JiraTicket[],
  phase: 'voting' as const,
  myVote: null as string | null,
  participants: [] as Participant[],
  currentTicketIndex: 0,
  completedTickets: [] as CompletedTicket[],
}

export const usePokerStore = create<PokerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      createRoom: (name, jiraConfig, tickets) => {
        const myId = crypto.randomUUID()
        const roomId = crypto.randomUUID()
        set({
          roomId,
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
        return roomId
      },

      joinRoom: (name, roomId) => {
        const myId = crypto.randomUUID()
        set((state) => ({
          roomId,
          myId,
          myName: name,
          phase: 'voting',
          myVote: null,
          participants: [...state.participants, { id: myId, name, hasVoted: false }],
        }))
      },

      leaveRoom: () => {
        set(initialState)
        sessionStorage.removeItem('poker-room')
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

      addParticipant: (p) =>
        set((state) => {
          if (state.participants.some((x) => x.id === p.id)) return {}
          return { participants: [...state.participants, p] }
        }),

      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== id),
        })),

      setParticipantVoted: (id) =>
        set((state) => ({
          participants: state.participants.map((p) =>
            p.id === id ? { ...p, hasVoted: true } : p,
          ),
        })),

      setParticipantVote: (id, vote) =>
        set((state) => ({
          participants: state.participants.map((p) =>
            p.id === id ? { ...p, hasVoted: true, vote } : p,
          ),
        })),

      applySyncState: (syncState) =>
        set((state) => {
          // 자신의 투표 상태는 유지하면서 나머지 상태를 동기화
          const myId = state.myId
          const myParticipant = state.participants.find((p) => p.id === myId)
          const mergedParticipants = syncState.participants.map((p) =>
            p.id === myId && myParticipant ? myParticipant : p,
          )
          // 자신이 목록에 없으면 추가
          if (myParticipant && !mergedParticipants.some((p) => p.id === myId)) {
            mergedParticipants.push(myParticipant)
          }
          return {
            participants: mergedParticipants,
            tickets: syncState.tickets,
            currentTicketIndex: syncState.currentTicketIndex,
            phase: syncState.phase,
            completedTickets: syncState.completedTickets,
          }
        }),

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
    }),
    {
      name: 'poker-room',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        roomId: state.roomId,
        myId: state.myId,
        myName: state.myName,
        jiraConfig: state.jiraConfig,
        tickets: state.tickets,
        phase: state.phase,
        myVote: state.myVote,
        participants: state.participants,
        currentTicketIndex: state.currentTicketIndex,
        completedTickets: state.completedTickets,
      }),
    },
  ),
)
