import { describe, expect, it } from 'bun:test'
import { backoffSeconds } from '../src/drivers/redis'
import { utcSeconds } from '../src/health'

/**
 * Two small unit slips with large effects:
 *
 * - The health check read a job's `created_at` - UTC, written without a zone -
 *   as local time. East of UTC every job looked hours old; west of UTC ages
 *   went negative and the check never alerted.
 * - The Redis driver turned a backoff of 0 seconds into 1, through `|| 1`.
 */
describe('utcSeconds', () => {
  it('reads a zoneless stored time as UTC', () => {
    expect(utcSeconds('2026-10-05 10:00:00')).toBe(Date.UTC(2026, 9, 5, 10) / 1000)
  })

  it('keeps a time that carries its own zone', () => {
    expect(utcSeconds('2026-10-05T12:00:00+02:00')).toBe(Date.UTC(2026, 9, 5, 10) / 1000)
    expect(utcSeconds('2026-10-05T10:00:00Z')).toBe(Date.UTC(2026, 9, 5, 10) / 1000)
  })
})

describe('backoffSeconds', () => {
  it('keeps zero', () => {
    expect(backoffSeconds(0)).toBe(0)
  })

  it('keeps a real delay', () => {
    expect(backoffSeconds(30)).toBe(30)
  })

  it('falls back to one second for something unusable', () => {
    expect(backoffSeconds(Number.NaN)).toBe(1)
    expect(backoffSeconds(-5)).toBe(1)
    expect(backoffSeconds('soon')).toBe(1)
  })
})
