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

interface CardLabel { id: number, name: string, color: string }
interface CardAssignee { userId: number, name: string | null, email: string | null }
interface CardComment {
  id: number
  uuid: string | null
  userId: number | null
  body: string
  authorName: string | null
  authorEmail: string | null
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
  // Optional pivot-derived fields. BoardShowAction populates them
  // (Phase 3); CardStoreAction's optimistic insert leaves them empty.
  labels?: CardLabel[]
  assignees?: CardAssignee[]
}

interface UserSummary { id: number, name: string | null, email: string | null }

interface CardDetail extends CardRecord {
  labels: CardLabel[]
  assignees: CardAssignee[]
  comments: CardComment[]
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

  // Phase 3 — card detail modal state. Holding card + comments here
  // (instead of one of column.cards) keeps the modal independent of
  // its source: opening from a card click on the board uses the
  // already-loaded preview; refresh-mid-modal hits /cards/:id and
  // hydrates from the network. Either way the modal reads from
  // `openCard` / `openCardComments`.
  const openCard = state<CardDetail | null>(null)
  const loadingCard = state(false)
  const errorCard = state<string | null>(null)
  const users = state<UserSummary[]>([])
  const loadingUsers = state(false)

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

  // ─── Phase 3 mutations (card detail) ─────────────────────────────

  /**
   * Helper: project a CardRecord (board view) onto a partial
   * CardDetail (modal view). Used when the modal opens against a
   * card already loaded into `currentColumns` — we fill in the
   * pivot-derived shape and fire `/cards/:id` in the background to
   * pick up comments.
   */
  function cardToDetail(c: CardRecord): CardDetail {
    return {
      ...c,
      labels: c.labels ?? [],
      assignees: c.assignees ?? [],
      comments: [], // hydrated by openCardDetail
    }
  }

  function findCardInColumns(cardId: number): CardRecord | null {
    for (const col of currentColumns())
      for (const card of col.cards)
        if (card.id === cardId) return card
    return null
  }

  async function openCardDetail(cardId: number): Promise<void> {
    loadingCard.set(true)
    errorCard.set(null)
    // Seed from the board view if we have it so the modal renders
    // immediately; the fetch fills in comments and refreshes labels
    // / assignees from the canonical store.
    const seed = findCardInColumns(cardId)
    if (seed)
      openCard.set(cardToDetail(seed))

    try {
      const res = await fetch(`/api/dashboard/kanban/cards/${cardId}`, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        card?: CardRecord
        labels?: CardLabel[]
        assignees?: CardAssignee[]
        comments?: CardComment[]
        error?: string
      }
      if (data.error || !data.card)
        throw new Error(data.error ?? 'Card not found')
      openCard.set({
        ...data.card,
        labels: data.labels ?? [],
        assignees: data.assignees ?? [],
        comments: data.comments ?? [],
      })
    }
    catch (e) {
      errorCard.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      loadingCard.set(false)
    }
  }

  function closeCardDetail(): void {
    openCard.set(null)
    errorCard.set(null)
  }

  /**
   * Apply an in-place patch to the open card AND to the matching card
   * inside `currentColumns` so the board view re-renders alongside
   * the modal. Reduces double-bookkeeping at every callsite.
   */
  function patchOpenCard(partial: Partial<CardDetail>): void {
    const oc = openCard()
    if (!oc) return
    openCard.set({ ...oc, ...partial })

    currentColumns.set(currentColumns().map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === oc.id ? { ...c, ...partial } : c),
    })))
  }

  async function updateCard(input: { title?: string, description?: string | null, dueDate?: string | null, archived?: boolean }): Promise<boolean> {
    const oc = openCard()
    if (!oc) return false
    const snapshot = { ...oc }
    patchOpenCard(input as Partial<CardDetail>)
    try {
      const res = await fetch(`/api/dashboard/kanban/cards/${oc.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { card?: CardRecord, error?: string }
      if (data.error || !data.card) throw new Error(data.error ?? 'Update failed')
      // Server-canonical state wins (handles trimming etc.).
      patchOpenCard(data.card)
      return true
    }
    catch (e) {
      // Roll back to the pre-patch snapshot.
      openCard.set(snapshot)
      currentColumns.set(currentColumns().map(col => ({
        ...col,
        cards: col.cards.map(c => c.id === snapshot.id ? snapshot : c),
      })))
      errorCard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function loadUsers(): Promise<void> {
    if (loadingUsers() || users().length > 0) return
    loadingUsers.set(true)
    try {
      const res = await fetch('/api/dashboard/kanban/users', { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { users?: UserSummary[] }
      users.set(data.users ?? [])
    }
    catch {
      // Soft-fail — assignee picker just shows empty.
    }
    finally {
      loadingUsers.set(false)
    }
  }

  async function syncCardLabels(cardId: number, labelIds: number[]): Promise<boolean> {
    const oc = openCard()
    if (!oc || oc.id !== cardId) return false
    const snapshot = oc.labels
    // Optimistic: keep only the labels in the new set, pulled from
    // the current open card's labels OR the board palette.
    const boardLabels = currentLabels()
    const optimistic = labelIds.map((id) => {
      const fromCard = oc.labels.find(l => l.id === id)
      if (fromCard) return fromCard
      const fromBoard = boardLabels.find(l => l.id === id)
      return fromBoard ? { id: fromBoard.id, name: fromBoard.name, color: fromBoard.color } : null
    }).filter((l): l is CardLabel => l !== null)
    patchOpenCard({ labels: optimistic })

    try {
      const res = await fetch(`/api/dashboard/kanban/cards/${cardId}/labels`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ labelIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { labels?: CardLabel[], error?: string }
      if (data.error) throw new Error(data.error)
      // Canonical reconciliation.
      patchOpenCard({ labels: data.labels ?? [] })
      return true
    }
    catch (e) {
      patchOpenCard({ labels: snapshot })
      errorCard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function syncCardAssignees(cardId: number, userIds: number[]): Promise<boolean> {
    const oc = openCard()
    if (!oc || oc.id !== cardId) return false
    const snapshot = oc.assignees
    // Optimistic — pull names from the loaded users list when
    // available; fall back to a minimal record so the avatar
    // initial renders something.
    const allUsers = users()
    const optimistic = userIds.map((id) => {
      const u = allUsers.find(x => x.id === id)
      return u
        ? { userId: u.id, name: u.name, email: u.email }
        : { userId: id, name: null, email: null }
    })
    patchOpenCard({ assignees: optimistic })

    try {
      const res = await fetch(`/api/dashboard/kanban/cards/${cardId}/assignees`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ userIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { assignees?: CardAssignee[], error?: string }
      if (data.error) throw new Error(data.error)
      patchOpenCard({ assignees: data.assignees ?? [] })
      return true
    }
    catch (e) {
      patchOpenCard({ assignees: snapshot })
      errorCard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function addComment(body: string): Promise<boolean> {
    const oc = openCard()
    if (!oc) return false
    const trimmed = body.trim()
    if (!trimmed) return false

    try {
      const res = await fetch(`/api/dashboard/kanban/cards/${oc.id}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { comment?: CardComment, error?: string }
      if (data.error || !data.comment) throw new Error(data.error ?? 'Comment failed')
      patchOpenCard({ comments: [...oc.comments, data.comment] })
      return true
    }
    catch (e) {
      errorCard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  async function deleteComment(commentId: number): Promise<boolean> {
    const oc = openCard()
    if (!oc) return false
    const snapshot = oc.comments
    patchOpenCard({ comments: oc.comments.filter(c => c.id !== commentId) })
    try {
      const res = await fetch(`/api/dashboard/kanban/comments/${commentId}`, { method: 'DELETE', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    }
    catch (e) {
      patchOpenCard({ comments: snapshot })
      errorCard.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // ─── Label CRUD (board scope) ──────────────────────────────────────

  async function createLabel(input: { boardId: number, name: string, color?: string }): Promise<LabelRecord | null> {
    try {
      const res = await fetch('/api/dashboard/kanban/labels', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { label?: LabelRecord, error?: string }
      if (data.error || !data.label) throw new Error(data.error ?? 'Create failed')
      currentLabels.set([...currentLabels(), data.label])
      return data.label
    }
    catch (e) {
      errorCard.set(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function deleteLabel(labelId: number): Promise<boolean> {
    const snapshot = currentLabels()
    currentLabels.set(snapshot.filter(l => l.id !== labelId))
    // Also strip the label from any cards on the board (mirrors what
    // LabelDestroyAction does server-side).
    const colSnapshot = currentColumns()
    currentColumns.set(colSnapshot.map(col => ({
      ...col,
      cards: col.cards.map(c => ({
        ...c,
        labels: (c.labels ?? []).filter(l => l.id !== labelId),
      })),
    })))
    const oc = openCard()
    if (oc)
      patchOpenCard({ labels: oc.labels.filter(l => l.id !== labelId) })

    try {
      const res = await fetch(`/api/dashboard/kanban/labels/${labelId}`, { method: 'DELETE', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    }
    catch (e) {
      currentLabels.set(snapshot)
      currentColumns.set(colSnapshot)
      errorCard.set(e instanceof Error ? e.message : String(e))
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
    // Phase 3
    openCard,
    loadingCard,
    errorCard,
    users,
    loadingUsers,
    openCardDetail,
    closeCardDetail,
    updateCard,
    loadUsers,
    syncCardLabels,
    syncCardAssignees,
    addComment,
    deleteComment,
    createLabel,
    deleteLabel,
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
