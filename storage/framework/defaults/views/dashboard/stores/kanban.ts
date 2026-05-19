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

  // ─── Mutations (Phase 2) ───────────────────────────────────────────
  //
  // Every mutation follows the same shape:
  //   1. Apply optimistically — update the local store immediately so
  //      the UI feels snappy.
  //   2. Fire the network request.
  //   3. On failure, restore the pre-mutation snapshot + set an error
  //      message. Phase 3 wires a toast helper into the rollback path
  //      so the user actually sees the failure.
  //
  // The mutations return the new entity (or null on failure) so
  // callers can chain further work or surface "saved!" toasts.

  async function createBoard(input: { name: string, description?: string, color?: string, icon?: string }): Promise<BoardSummary | null> {
    const snapshot = boards()
    try {
      const res = await fetch('/api/dashboard/kanban/boards', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { board?: BoardSummary, error?: string }
      if (data.error || !data.board) throw new Error(data.error ?? 'Create failed')
      boards.set([...snapshot, data.board])
      return data.board
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function deleteBoard(id: number): Promise<boolean> {
    const snapshot = boards()
    // Optimistic remove.
    boards.set(snapshot.filter(b => b.id !== id))
    try {
      const res = await fetch(`/api/dashboard/kanban/boards/${id}`, { method: 'DELETE', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    }
    catch (e) {
      boards.set(snapshot)
      error.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function createColumn(input: { boardId: number, name: string, color?: string }): Promise<ColumnRecord | null> {
    const snapshot = currentColumns()
    try {
      const res = await fetch('/api/dashboard/kanban/columns', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { column?: ColumnRecord, error?: string }
      if (data.error || !data.column) throw new Error(data.error ?? 'Create failed')
      currentColumns.set([...snapshot, data.column])
      return data.column
    }
    catch (e) {
      errorBoard.set(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function deleteColumn(columnId: number): Promise<boolean> {
    const snapshot = currentColumns()
    currentColumns.set(snapshot.filter(c => c.id !== columnId))
    try {
      const res = await fetch(`/api/dashboard/kanban/columns/${columnId}`, { method: 'DELETE', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    }
    catch (e) {
      currentColumns.set(snapshot)
      errorBoard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function createCard(input: { columnId: number, title: string, description?: string }): Promise<CardRecord | null> {
    const snapshot = currentColumns()
    try {
      const res = await fetch('/api/dashboard/kanban/cards', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { card?: CardRecord, error?: string }
      if (data.error || !data.card) throw new Error(data.error ?? 'Create failed')
      currentColumns.set(snapshot.map(col =>
        col.id === input.columnId
          ? { ...col, cards: [...col.cards, data.card!] }
          : col,
      ))
      return data.card
    }
    catch (e) {
      errorBoard.set(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function deleteCard(cardId: number): Promise<boolean> {
    const snapshot = currentColumns()
    currentColumns.set(snapshot.map(col => ({
      ...col,
      cards: col.cards.filter(c => c.id !== cardId),
    })))
    try {
      const res = await fetch(`/api/dashboard/kanban/cards/${cardId}`, { method: 'DELETE', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    }
    catch (e) {
      currentColumns.set(snapshot)
      errorBoard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  /**
   * Reorder cards across one or more columns of the current board.
   * Called by the drag-and-drop handler in `kanban/[id].stx` after a
   * card move. Sends the full per-column state so neighbour
   * positions never drift — see the CardsReorderAction docstring.
   *
   * @param payload one entry per affected column with that column's
   *   new ordered list of card ids
   */
  async function reorderCards(payload: Array<{ columnId: number, order: number[] }>): Promise<boolean> {
    const snapshot = currentColumns()

    // Apply optimistically — derive the new column state from the
    // payload + existing cards.
    const cardById = new Map<number, CardRecord>()
    for (const col of snapshot)
      for (const c of col.cards) cardById.set(c.id, c)

    const next = snapshot.map((col) => {
      const entry = payload.find(p => p.columnId === col.id)
      if (!entry) return col
      const reordered = entry.order
        .map((id, i) => {
          const card = cardById.get(id)
          if (!card) return null
          return { ...card, columnId: col.id, position: i }
        })
        .filter((c): c is CardRecord => c !== null)
      return { ...col, cards: reordered }
    })
    currentColumns.set(next)

    try {
      const res = await fetch('/api/dashboard/kanban/cards/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ columns: payload }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { moved?: number, error?: string }
      if (data.error) throw new Error(data.error)
      return true
    }
    catch (e) {
      currentColumns.set(snapshot)
      errorBoard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function reorderColumns(boardId: number, order: number[]): Promise<boolean> {
    const snapshot = currentColumns()
    // Optimistic reorder by sorting against the supplied id list.
    const byId = new Map(snapshot.map(c => [c.id, c] as const))
    const next = order.map((id, i) => {
      const col = byId.get(id)
      return col ? { ...col, position: i } : null
    }).filter((c): c is ColumnRecord => c !== null)
    currentColumns.set(next)

    try {
      const res = await fetch('/api/dashboard/kanban/columns/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ boardId, order }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { reordered?: number, error?: string }
      if (data.error) throw new Error(data.error)
      return true
    }
    catch (e) {
      currentColumns.set(snapshot)
      errorBoard.set(e instanceof Error ? e.message : String(e))
      return false
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
    createBoard,
    deleteBoard,
    createColumn,
    deleteColumn,
    createCard,
    deleteCard,
    reorderCards,
    reorderColumns,
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
