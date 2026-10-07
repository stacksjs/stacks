/**
 * The decisions behind `buddy feedback:invite`, `feedback:tokens` and
 * `feedback:revoke`, kept out of the command so they can be tested.
 *
 * A feedback link is a capability: it may add one card to one board and can
 * authenticate nothing (see the `FeedbackToken` model and
 * stacksjs/stacks#2872). Until these commands existed the only way to mint
 * one was to insert a row by hand and hash the token yourself, which meant
 * the feature could not be exercised at all.
 */

/** The board a link files into when `--board` is not given. */
export const FEEDBACK_BOARD_NAME = 'Feedback'

/**
 * The columns a board created by `feedback:invite --create-board` gets.
 *
 * The intake action files into the board's first column by position, so the
 * first entry is where submissions land and the rest are where they go next.
 * A board with no columns admits a valid token and then has nowhere to put
 * the card, which the action reports as an invalid link, so creating the
 * board without columns would be worse than not creating it.
 */
export const FEEDBACK_BOARD_COLUMNS = ['Inbox', 'Triaged', 'In Progress', 'Done'] as const

/** Either a row id or a name, whichever the operator typed. */
export type RowRef = { kind: 'id', id: number } | { kind: 'name', name: string }

/**
 * Read an argument that may be an id or a name.
 *
 * All digits reads as an id, because that is what the listing prints and what
 * an operator copies out of it. A board named `42` is therefore reachable
 * only by its id, which is the right way round: ids are unique and names are
 * not.
 */
export function parseRowRef(value: string | undefined): RowRef | null {
  const input = (value ?? '').trim()
  if (!input)
    return null
  if (/^\d+$/.test(input)) {
    const id = Number(input)
    return Number.isSafeInteger(id) && id > 0 ? { kind: 'id', id } : null
  }
  return { kind: 'name', name: input }
}

/** `--board`, defaulting to the conventional feedback board. */
export function parseBoardRef(value: string | undefined): RowRef {
  return parseRowRef(value) ?? { kind: 'name', name: FEEDBACK_BOARD_NAME }
}

export type ExpiryChoice =
  | { ok: true, at: Date | null }
  | { ok: false, message: string }

/**
 * `--expires <days>`, as an absolute instant.
 *
 * Days rather than a date because an invite is written in terms of how long
 * the reviewer needs it, and because a bare date has no timezone. Omitted
 * means the link does not expire on its own; revocation still stops it.
 *
 * `0` is refused rather than read as "never": an operator who means never
 * leaves the flag off, and one who types `0` expecting that would otherwise
 * mint a link that is already dead and only find out from the reviewer.
 */
export function parseExpiryDays(value: string | undefined, now: Date): ExpiryChoice {
  if (value === undefined)
    return { ok: true, at: null }

  const input = String(value).trim()
  if (!input)
    return { ok: false, message: '--expires needs a number of days, for example --expires 30.' }
  if (!/^\d+$/.test(input))
    return { ok: false, message: `--expires takes a whole number of days, not \`${input}\`.` }

  const days = Number(input)
  if (days < 1)
    return { ok: false, message: '--expires must be at least 1 day. To stop a link now, use `buddy feedback:revoke`.' }

  return { ok: true, at: new Date(now.getTime() + days * 86_400_000) }
}

/**
 * A timestamp in the `YYYY-MM-DD HH:MM:SS` shape the columns hold, in UTC.
 *
 * Matches what the intake action writes to `last_used_at` and what
 * `parseTokenTime` reads back as UTC. Writing a local-time string here would
 * expire a link hours early or late depending on where it was minted.
 */
export function toStoredTimestamp(at: Date): string {
  return at.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * The URL to hand the reviewer: the form, not the endpoint behind it.
 *
 * `/feedback/{token}` is the page; it posts to `/api/feedback/{token}` itself.
 * Handing out the endpoint would hand out something only a developer with a
 * terminal could use.
 *
 * `config.app.url` is a bare host in a default app (`stacks.localhost`), so
 * the scheme is added when it is missing, the way the dev server and the
 * mobile build already do. Any path, query or fragment on the configured URL
 * is dropped: the page is registered at an absolute path.
 */
export function feedbackSubmitUrl(appUrl: string | undefined, rawToken: string): string {
  const base = (appUrl ?? '').trim()
  if (!base)
    throw new Error('No app URL configured. Set APP_URL or config.app.url.')

  const url = new URL(/^https?:\/\//i.test(base) ? base : `https://${base}`)
  url.pathname = `/feedback/${rawToken}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** Why a listed link would be refused, or that it would not be. */
export type FeedbackTokenStatus = 'active' | 'revoked' | 'expired' | 'unbound'

export interface FeedbackTokenSummary {
  id: number
  label: string
  boardId: number
  status: FeedbackTokenStatus
  /** Already formatted for display, or null for never. */
  lastUsedAt: string | null
  expiresAt: string | null
}

/**
 * The `feedback:tokens` table.
 *
 * The status column comes from the same `authorizeFeedbackToken` the intake
 * action uses, so the listing cannot claim a link works when a submission
 * through it would be refused.
 */
export function renderFeedbackTokens(rows: FeedbackTokenSummary[]): string {
  if (rows.length === 0)
    return '  No feedback links. Create one with `buddy feedback:invite <label>`.'

  const widest = (pick: (row: FeedbackTokenSummary) => string, header: string) =>
    Math.max(header.length, ...rows.map(row => pick(row).length))

  const label = widest(row => row.label, 'LABEL')
  const status = widest(row => row.status, 'STATUS')
  const used = widest(row => row.lastUsedAt ?? 'never', 'LAST USED')

  const lines = [
    `  ${'ID'.padStart(4)}  ${'LABEL'.padEnd(label)}  ${'BOARD'.padStart(5)}  ${'STATUS'.padEnd(status)}  ${'LAST USED'.padEnd(used)}  EXPIRES`,
  ]

  for (const row of rows) {
    lines.push([
      `  ${String(row.id).padStart(4)}`,
      row.label.padEnd(label),
      String(row.boardId).padStart(5),
      row.status.padEnd(status),
      (row.lastUsedAt ?? 'never').padEnd(used),
      row.expiresAt ?? 'never',
    ].join('  '))
  }

  return lines.join('\n')
}
