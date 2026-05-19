import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'

interface BoardSummary {
  id: number
  uuid: string | null
  name: string
  description: string | null
  icon: string
  color: string
  position: number
  archived: boolean
  cardCount: number
  createdAt: string | null
  updatedAt: string | null
}

interface CardRecord {
  id: number
  uuid: string | null
  columnId: number
  boardId: number
  title: string
  description: string | null
  position: number
  createdByUserId: number | null
  dueDate: string | null
  archived: boolean
  createdAt: string | null
  updatedAt: string | null
}

interface ColumnRecord {
  id: number
  uuid: string | null
  boardId: number
  name: string
  position: number
  cardLimit: number | null
  color: string
  cards: CardRecord[]
}

interface LabelRecord {
  id: number
  boardId: number
  name: string
  color: string
}

interface BoardDetail {
  id: number
  uuid: string | null
  name: string
  description: string | null
  icon: string
  color: string
  position: number
  archived: boolean
  createdAt: string | null
  updatedAt: string | null
}

/**
 * Kanban dashboard store (stacksjs/stacks#1846).
 *
 * Phase 1 surface — list of boards for the index page plus the
 * fetch-by-id helper that the board detail page (Phase 2) will use.
 * Drag-and-drop reorder, write mutations, and label/assignee ops land
 * in Phase 2 / Phase 3.
 *
 * Persistence: only the last-viewed board id is cached in
 * sessionStorage so the user lands back where they left off when they
 * SPA-nav between unrelated dashboard pages. The actual data is always
 * re-fetched.
 */
export const kanbanStore = defineStore('kanban', () => {
  const boards = state<BoardSummary[]>([])
  const currentBoard = state<BoardDetail | null>(null)
  const currentColumns = state<ColumnRecord[]>([])
  const currentLabels = state<LabelRecord[]>([])
  const lastViewedBoardId = state<number | null>(null)
  const loading = state(true)
  const loadingBoard = state(false)
  const error = state<string | null>(null)
  const errorBoard = state<string | null>(null)

  const hasBoards = derived(() => boards().length > 0)

  async function loadBoards(): Promise<void> {
    loading.set(true)
    error.set(null)
    try {
      const res = await fetch('/api/dashboard/kanban/boards', { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { boards: BoardSummary[], error?: string }
      if (data.error) {
        error.set(data.error)
        boards.set([])
        return
      }
      boards.set(data.boards ?? [])
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      loading.set(false)
    }
  }

  async function loadBoard(id: number): Promise<void> {
    loadingBoard.set(true)
    errorBoard.set(null)
    lastViewedBoardId.set(id)
    try {
      const res = await fetch(`/api/dashboard/kanban/boards/${id}`, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        board?: BoardDetail
        columns?: ColumnRecord[]
        labels?: LabelRecord[]
        error?: string
      }
      if (data.error || !data.board) {
        errorBoard.set(data.error ?? 'Board not found')
        currentBoard.set(null)
        currentColumns.set([])
        currentLabels.set([])
        return
      }
      currentBoard.set(data.board)
      currentColumns.set(data.columns ?? [])
      currentLabels.set(data.labels ?? [])
    }
    catch (e) {
      errorBoard.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      loadingBoard.set(false)
    }
  }

  return {
    boards,
    currentBoard,
    currentColumns,
    currentLabels,
    lastViewedBoardId,
    loading,
    loadingBoard,
    error,
    errorBoard,
    hasBoards,
    loadBoards,
    loadBoard,
  }
}, {
  persist: {
    storage: 'sessionStorage',
    key: 'stacks-dashboard-kanban',
    pick: ['lastViewedBoardId'],
  },
})

if (typeof window !== 'undefined')
  registerStoresClient({ kanbanStore })
