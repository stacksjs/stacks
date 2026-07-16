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
