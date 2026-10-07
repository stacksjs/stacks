import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { parseTokenTime } from '../../../defaults/app/Actions/Dashboard/Feedback/feedback-token'
import {
  FEEDBACK_BOARD_COLUMNS,
  FEEDBACK_BOARD_NAME,
  feedbackSubmitUrl,
  parseBoardRef,
  parseExpiryDays,
  parseRowRef,
  renderFeedbackTokens,
  toStoredTimestamp,
} from '../src/feedback-links'

/**
 * The decisions `buddy feedback:invite` makes before it touches the database.
 *
 * Each one of these is reachable only through a command that mints a
 * credential and exits, so leaving them in the action body would mean the
 * only way to find out that `--expires 0` mints a dead link is from the
 * reviewer it was handed to.
 */

const DAY = 86_400_000

describe('parseRowRef', () => {
  it('reads all digits as an id and anything else as a name', () => {
    expect(parseRowRef('3')).toEqual({ kind: 'id', id: 3 })
    expect(parseRowRef(' 12 ')).toEqual({ kind: 'id', id: 12 })
    expect(parseRowRef('Feedback')).toEqual({ kind: 'name', name: 'Feedback' })
    expect(parseRowRef('Design review')).toEqual({ kind: 'name', name: 'Design review' })
  })

  it('refuses nothing, and ids that are not row ids', () => {
    expect(parseRowRef(undefined)).toBeNull()
    expect(parseRowRef('')).toBeNull()
    expect(parseRowRef('   ')).toBeNull()
    // `0` is not a row id, and reading it as one would send the lookup after
    // a board that cannot exist rather than reporting the argument.
    expect(parseRowRef('0')).toBeNull()
  })

  it('reads a negative number as a name, not as an id', () => {
    // Nothing is named `-1`, so this resolves to "no such board" rather than
    // to board 1. Worth pinning: the digits-only test is what keeps a sign
    // from being dropped.
    expect(parseRowRef('-1')).toEqual({ kind: 'name', name: '-1' })
  })
})

describe('parseBoardRef', () => {
  it('defaults to the conventional feedback board', () => {
    expect(parseBoardRef(undefined)).toEqual({ kind: 'name', name: FEEDBACK_BOARD_NAME })
    expect(parseBoardRef('')).toEqual({ kind: 'name', name: FEEDBACK_BOARD_NAME })
  })

  it('takes an explicit board either way', () => {
    expect(parseBoardRef('7')).toEqual({ kind: 'id', id: 7 })
    expect(parseBoardRef('Bugs')).toEqual({ kind: 'name', name: 'Bugs' })
  })
})

describe('parseExpiryDays', () => {
  const now = new Date('2026-10-08T12:00:00Z')

  it('omitted means the link lasts until it is revoked', () => {
    expect(parseExpiryDays(undefined, now)).toEqual({ ok: true, at: null })
  })

  it('counts whole days from now', () => {
    const result = parseExpiryDays('30', now)
    expect(result.ok).toBe(true)
    expect((result as { at: Date }).at.getTime()).toBe(now.getTime() + 30 * DAY)
  })

  it('refuses zero rather than reading it as never', () => {
    const result = parseExpiryDays('0', now)
    expect(result.ok).toBe(false)
    expect((result as { message: string }).message).toContain('at least 1 day')
  })

  it('refuses anything that is not a count of days', () => {
    for (const bad of ['', '  ', 'abc', '1.5', '-5', '30d', '1e3']) {
      const result = parseExpiryDays(bad, now)
      expect(result.ok).toBe(false)
    }
  })
})

describe('toStoredTimestamp', () => {
  it('writes UTC in the shape the columns hold', () => {
    expect(toStoredTimestamp(new Date('2026-10-08T12:34:56Z'))).toBe('2026-10-08 12:34:56')
    // An instant that is a different calendar day in most local timezones.
    expect(toStoredTimestamp(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-01 23:30:00')
  })

  it('round-trips through the reading the intake action does', () => {
    // The contract that matters: the command writes `expires_at` and
    // `authorizeFeedbackToken` reads it back through `parseTokenTime`. If
    // either side swaps to local time a link expires hours early or late,
    // and nothing in either module alone would show it.
    const at = new Date('2026-10-08T12:34:56Z')
    expect(parseTokenTime(toStoredTimestamp(at))).toBe(at.getTime())
  })

  it('writes the one shape parseTokenTime reads as UTC', () => {
    // `parseTokenTime` appends the `Z` only for `YYYY-MM-DD HH:MM:SS`.
    // Anything else - an ISO string with a `T`, say - falls through to
    // `Date.parse`, which reads a timestamp with no zone as LOCAL time. So
    // the shape is the contract and not a formatting preference.
    expect(toStoredTimestamp(new Date('2026-10-08T12:34:56Z'))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('writes UTC on a machine that is not in UTC', async () => {
    // The assertions above cannot see the difference on a runner whose clock
    // is already UTC, which is most of them, so this one asks a process that
    // is somewhere else. Without it a local-time implementation ships green
    // from CI and expires every link nine hours out.
    const probe = `
      const { toStoredTimestamp } = await import('${join(import.meta.dir, '..', 'src', 'feedback-links.ts')}')
      process.stdout.write(toStoredTimestamp(new Date('2026-10-08T12:34:56Z')))
    `
    const run = Bun.spawnSync(['bun', '-e', probe], { env: { ...process.env, TZ: 'Asia/Tokyo' } })
    expect(new TextDecoder().decode(run.stdout).trim()).toBe('2026-10-08 12:34:56')
  })
})

describe('feedbackSubmitUrl', () => {
  const raw = 'a'.repeat(64)

  it('adds the scheme a bare configured host does not have', () => {
    expect(feedbackSubmitUrl('stacks.localhost', raw)).toBe(`https://stacks.localhost/api/feedback/${raw}`)
  })

  it('keeps a configured scheme, including a local http one', () => {
    expect(feedbackSubmitUrl('http://localhost:3000', raw)).toBe(`http://localhost:3000/api/feedback/${raw}`)
    expect(feedbackSubmitUrl('https://example.com', raw)).toBe(`https://example.com/api/feedback/${raw}`)
  })

  it('drops a path, query or fragment on the configured URL', () => {
    // The route is registered at an absolute path, so carrying a configured
    // path through would produce a link that 404s.
    expect(feedbackSubmitUrl('https://example.com/dashboard?a=1#x', raw)).toBe(`https://example.com/api/feedback/${raw}`)
  })

  it('refuses to invent a host', () => {
    expect(() => feedbackSubmitUrl(undefined, raw)).toThrow('No app URL configured')
    expect(() => feedbackSubmitUrl('   ', raw)).toThrow('No app URL configured')
  })
})

describe('renderFeedbackTokens', () => {
  it('says how to make one when there are none', () => {
    expect(renderFeedbackTokens([])).toContain('buddy feedback:invite')
  })

  it('shows the status and reads unset timestamps as never', () => {
    const out = renderFeedbackTokens([
      { id: 3, label: 'Pawel', boardId: 2, status: 'active', lastUsedAt: '2026-10-08 09:12:00', expiresAt: null },
      { id: 1, label: 'Design review', boardId: 2, status: 'revoked', lastUsedAt: null, expiresAt: '2026-11-01 00:00:00' },
    ])

    expect(out).toContain('Pawel')
    expect(out).toContain('active')
    expect(out).toContain('revoked')
    expect(out).toContain('2026-10-08 09:12:00')
    expect(out).toContain('never')
    // Columns line up on the widest value rather than a fixed guess, so a
    // long label does not push the rest of the row out of its column.
    const [header, first, second] = out.split('\n')
    expect(header.indexOf('STATUS')).toBe(first.indexOf('active'))
    expect(first.indexOf('active')).toBe(second.indexOf('revoked'))
  })
})

describe('the feedback board template', () => {
  it('files submissions into its first column', () => {
    // The intake action picks the lowest `position`, so the first entry here
    // is the one a reviewer's card lands in.
    expect(FEEDBACK_BOARD_COLUMNS[0]).toBe('Inbox')
    expect(FEEDBACK_BOARD_COLUMNS.length).toBeGreaterThan(1)
  })
})
