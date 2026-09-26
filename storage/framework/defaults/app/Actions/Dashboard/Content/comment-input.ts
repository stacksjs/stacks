import { str } from './content-input'

/** The `comments.status` CHECK constraint, in one place. */
export const COMMENT_STATUSES = ['pending', 'approved', 'spam', 'trash'] as const

export type CommentStatus = typeof COMMENT_STATUSES[number]

function isCommentStatus(value: string): value is CommentStatus {
  return (COMMENT_STATUSES as readonly string[]).includes(value)
}

/**
 * Read-side normalization: fold casing and fall back to 'pending'.
 *
 * The CHECK constraint keeps SQL honest, but rows predating it (and hand-written
 * seeds) have been seen with 'Pending', so the dashboard's status filter and
 * badge styling only ever see one casing.
 */
export function normalizeCommentStatus(value: unknown): CommentStatus {
  const status = str(value).toLowerCase()

  return isCommentStatus(status) ? status : 'pending'
}

/**
 * Write-side validation: an unknown status is rejected rather than coerced.
 *
 * A moderation write silently landing as 'pending' would be worse than an
 * error, and the CHECK constraint would reject it anyway — as a 500.
 */
export function parseCommentStatus(value: unknown): CommentStatus | undefined {
  const status = str(value).toLowerCase()

  return isCommentStatus(status) ? status : undefined
}

/**
 * Where a dashboard comment lives.
 *
 * `comments` is the model-backed table the CMS form writes. `commentables` is
 * the polymorphic table the `commentable` model trait writes
 * (`post.addComment(...)`), with its own ids, so the two can both have a
 * comment 1. Every write names its source; an absent one means `comments`,
 * which is what every caller sent before trait comments were listed.
 */
export const COMMENT_SOURCES = ['comments', 'commentables'] as const

export type CommentSource = typeof COMMENT_SOURCES[number]

export function parseCommentSource(value: unknown): CommentSource | undefined {
  const source = str(value).trim().toLowerCase()
  if (!source)
    return 'comments'

  return (COMMENT_SOURCES as readonly string[]).includes(source) ? source as CommentSource : undefined
}

/** The statuses the `commentable` trait, the CMS and `buddy comments:*` use. */
export type CommentableStatus = 'pending' | 'approved' | 'rejected'

/**
 * A dashboard status as the trait stores it. The trait has one way to hide a
 * comment, `rejected`, so spam and trash both land there: writing either
 * spelling would hide it from `rejectedComments()` and the CLI's filter.
 */
export function commentableStatusFor(status: CommentStatus): CommentableStatus {
  if (status === 'approved' || status === 'pending')
    return status

  return 'rejected'
}

/** A stored trait status as the dashboard shows it; `rejected` reads as spam. */
export function dashboardStatusForCommentable(value: unknown): CommentStatus {
  const status = str(value).toLowerCase()
  if (status === 'approved')
    return 'approved'
  if (status === 'rejected')
    return 'spam'

  return 'pending'
}

export interface CommentableRow {
  id: number
  title?: string | null
  body: string | null
  status: string | null
  commentables_id: number
  commentables_type: string
  user_id?: number | null
  author_name?: string | null
  author_email?: string | null
  created_at: string | null
  updated_at?: string | null
}

/** One row of the dashboard's comment list, from either table. */
export interface DashboardComment {
  key: string
  source: CommentSource
  id: number
  author_name: string
  author_email: string
  content: string
  post_title: string
  status: CommentStatus
  is_approved: boolean
  created_at: string | null
  updated_at: string | null
}

/**
 * A trait comment in the dashboard's shape. `ownerLabel` names what it was
 * left on, e.g. the post title, since the row only carries a type and an id.
 *
 * `author_email` is included because this is the moderation view, the one
 * place a site owner needs it. It is not for display anywhere else.
 */
export function commentableRecord(row: CommentableRow, ownerLabel = ''): DashboardComment {
  const status = dashboardStatusForCommentable(row.status)
  const author = str(row.author_name) || (row.user_id ? `User #${row.user_id}` : '')
  // The trait's title is optional and usually empty; when a caller did give
  // one it is part of what the reader wrote, so keep it above the body.
  const title = str(row.title).trim()
  const body = str(row.body)

  return {
    key: `commentables:${row.id}`,
    source: 'commentables',
    id: Number(row.id),
    author_name: author,
    author_email: str(row.author_email),
    content: title ? `${title}\n\n${body}` : body,
    post_title: ownerLabel,
    status,
    is_approved: status === 'approved',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }
}

/** A table name read from `commentables_type`, safe to use as an identifier. */
export function isSafeTableName(value: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(value) && value.length <= 64
}

/**
 * Newest first across both tables. `comments` writes `YYYY-MM-DD HH:MM:SS`
 * and the trait writes `YYYY-MM-DDTHH:MM:SS`, so compare the normalized form
 * rather than the raw strings, which would sort every ISO timestamp after
 * every space-separated one on the same day.
 */
export function newestFirst(a: DashboardComment, b: DashboardComment): number {
  const at = (value: string | null) => str(value).replace('T', ' ').slice(0, 19)

  return at(b.created_at).localeCompare(at(a.created_at)) || b.key.localeCompare(a.key)
}

/**
 * Whether a database error means the table is not there at all: SQLite's
 * "no such table", MySQL's "Table '…' doesn't exist", Postgres's "relation
 * … does not exist". Narrow on purpose, a missing COLUMN is a real fault.
 */
export function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return /no such table|table \S+ doesn't exist|relation \S+ does not exist/i.test(message)
}
