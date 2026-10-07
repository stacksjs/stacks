import { createHash, randomBytes } from 'node:crypto'

/**
 * Whether a feedback link may still file a card, and on which board.
 *
 * Kept pure and separate from the action: this is the whole security boundary
 * for an unauthenticated write path, and a decision that can only be reached
 * through an HTTP request is a decision that does not get tested properly.
 * The action does the lookup and the writing; everything that decides *yes or
 * no* is here.
 *
 * A feedback token is a capability, not an identity. It names a board, it is
 * read only by the intake action, and it never resolves to a user, so it can
 * authenticate nothing. See the `FeedbackToken` model for why a personal
 * access token would have been an account in disguise.
 */

/** 256 bits. The raw token is the only secret, so it carries all the entropy. */
export const FEEDBACK_TOKEN_BYTES = 32

/**
 * What a submission may carry, matching `cards.title` and
 * `cards.description`.
 *
 * Here rather than in the action so the form can render the same limits it
 * will be judged against. A `maxlength` the server disagrees with is the
 * worst of both: the reviewer is either stopped from typing something that
 * would have been accepted, or allowed to write a report that is refused on
 * submit.
 */
export const FEEDBACK_MAX_TITLE = 300
export const FEEDBACK_MAX_DESCRIPTION = 10_000

/** A raw token as it appears in a link, and as the column stores it. */
const RAW_TOKEN = /^[0-9a-f]{64}$/

/**
 * SHA-256 hex, which is what `feedback_tokens.token` holds.
 *
 * Deterministic on purpose: a submit is one indexed lookup. With 256 bits of
 * entropy in the raw value an offline attack on a fast hash is irrelevant,
 * which is the same reasoning `MagicLinkToken` records and deliberately not
 * the bcrypt-and-scan of password resets.
 *
 * `@stacksjs/auth` defines this same one-liner privately three times over
 * (`tokens.ts`, `authentication.ts`, `magic-link.ts`) and exports none of
 * them, so this is a fourth rather than a refactor of a security module in
 * passing.
 */
export function hashFeedbackToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** A new link's raw token and the hash to store for it. */
export function mintFeedbackToken(): { raw: string, hash: string } {
  const raw = randomBytes(FEEDBACK_TOKEN_BYTES).toString('hex')
  return { raw, hash: hashFeedbackToken(raw) }
}

/**
 * Does this even have the shape of a token?
 *
 * Checked before the lookup so a submit carrying a sentence, a path, or a SQL
 * fragment is refused without touching the database.
 */
export function looksLikeFeedbackToken(raw: unknown): raw is string {
  return typeof raw === 'string' && RAW_TOKEN.test(raw)
}

export type FeedbackTokenRefusal = 'malformed' | 'unknown' | 'revoked' | 'expired' | 'unbound'

export type FeedbackTokenVerdict =
  | { ok: true, boardId: number }
  | { ok: false, reason: FeedbackTokenRefusal }

/**
 * A `feedback_tokens` row, in either spelling.
 *
 * The ORM hands back camelCase or snake_case depending on the path taken, and
 * the Kanban actions already read `boardId ?? board_id` for the same reason.
 */
export interface FeedbackTokenRow {
  boardId?: unknown
  board_id?: unknown
  revokedAt?: unknown
  revoked_at?: unknown
  expiresAt?: unknown
  expires_at?: unknown
}

function firstDefined(...values: unknown[]): unknown {
  return values.find(value => value !== undefined && value !== null)
}

/**
 * A stored timestamp as epoch milliseconds, read as UTC.
 *
 * Exported so the UTC reading can be pinned directly. Asserting it through a
 * verdict cannot: both interpretations of a given row usually land on the
 * same side of `now`, so such a test passes whether or not the normalisation
 * below exists, and it did.
 */
export function parseTokenTime(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return value.getTime()
  // SQLite hands back `YYYY-MM-DD HH:MM:SS`, which `Date` parses as local
  // time on some engines and UTC on others. Normalising to ISO keeps a token
  // from appearing to expire an hour early or late depending on the dialect.
  if (typeof value === 'string') {
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
    const parsed = Date.parse(normalized)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value === 'number') return value
  return null
}

/**
 * The verdict for a row that has already been looked up by token hash.
 *
 * Revocation is checked before expiry, so a token that is both reports the
 * reason an operator acted on. The verdict carries a board id and a reason
 * and never the token, so it is safe to log.
 */
export function authorizeFeedbackToken(row: FeedbackTokenRow | null | undefined, now: Date = new Date()): FeedbackTokenVerdict {
  if (!row) return { ok: false, reason: 'unknown' }

  if (firstDefined(row.revokedAt, row.revoked_at) !== undefined)
    return { ok: false, reason: 'revoked' }

  const expiresAt = parseTokenTime(firstDefined(row.expiresAt, row.expires_at))
  if (expiresAt !== null && expiresAt <= now.getTime())
    return { ok: false, reason: 'expired' }

  const boardId = Number(firstDefined(row.boardId, row.board_id))
  if (!Number.isInteger(boardId) || boardId <= 0)
    return { ok: false, reason: 'unbound' }

  return { ok: true, boardId }
}

/** What to tell the submitter. Deliberately the same for every refusal. */
export function refusalMessage(): string {
  // One message for unknown, revoked and expired alike: distinguishing them
  // tells a holder of a guessed token which half of the guess was right, and
  // tells a revoked reviewer they were revoked rather than that the link is
  // simply no longer valid.
  return 'This feedback link is not valid.'
}
