/**
 * stacksjs/stacks#2282 item 3 — `DispatchedBatch.add` was read-modify-write.
 *
 * It read the record, added in JavaScript, and wrote the absolute result back:
 *
 *     const newTotal = record.total_jobs + batchableJobs.length
 *     await updateBatchRecord(this.id, { total_jobs: newTotal, ... })
 *
 * Two callers adding to the same in-flight batch at the same instant both read
 * total=N and both wrote total=N+their own count, so one add vanished. The
 * batch then reported fewer jobs than it was really running, `pending_jobs`
 * could never reach zero, and the terminal `then`/`finally` callbacks never
 * fired — the same race `recordBatchJobCompletion` was given an atomic
 * decrement for, on the way in rather than on the way out.
 *
 * The payload assertions below are behavioural: they run the real function and
 * inspect what it hands the driver. They deliberately do NOT mock
 * `@stacksjs/database` to reach further. `mock.module` is process-global and
 * bun runs a package's test files in one process, so mocking a module this
 * widely used takes the rest of the package down with it — tried, and the queue
 * suite went from 299 passing to 202.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { batchCounterIncrements } from '../src/batch'

/** Stands in for the query builder's tagged template, keeping the literal SQL. */
interface SqlFragment { text: string, values: unknown[] }

const sql = (strings: TemplateStringsArray, ...values: unknown[]): SqlFragment => ({
  text: strings.raw.join('?'),
  values,
})

describe('batch counter increments are relative, not computed (#2282 item 3)', () => {
  it('asks the database to add, rather than supplying a total', () => {
    const set = batchCounterIncrements(sql as any, 2) as { total_jobs: SqlFragment, pending_jobs: SqlFragment }

    // A bare number here is the old read-modify-write, and therefore lossy
    // whenever two adds overlap.
    expect(typeof set.total_jobs).not.toBe('number')
    expect(typeof set.pending_jobs).not.toBe('number')

    expect(set.total_jobs.text).toBe('total_jobs + ?')
    expect(set.pending_jobs.text).toBe('pending_jobs + ?')
    expect(set.total_jobs.values).toEqual([2])
    expect(set.pending_jobs.values).toEqual([2])
  })

  it('carries the delta through rather than a resolved total', () => {
    const set = batchCounterIncrements(sql as any, 7) as { total_jobs: SqlFragment }
    expect(set.total_jobs.values).toEqual([7])
  })

  it('moves both counters together, so pending can still reach zero', () => {
    const set = batchCounterIncrements(sql as any, 3) as Record<string, SqlFragment>
    expect(Object.keys(set).sort()).toEqual(['pending_jobs', 'total_jobs'])
    expect(set.total_jobs.values).toEqual(set.pending_jobs.values)
  })
})

/**
 * The wiring, pinned separately. Proving `add` reaches the atomic path needs a
 * database, so what is checkable here is that it no longer does the arithmetic
 * itself. Kept narrow on purpose: it asserts the absence of the specific
 * lossy expression, not the presence of any particular replacement.
 */
describe('DispatchedBatch.add no longer computes its own totals (#2282 item 3)', () => {
  const src = readFileSync(resolve(__dirname, '..', 'src', 'batch.ts'), 'utf-8')
  const add = src.slice(src.indexOf('async add('), src.indexOf('async add(') + 1200)

  it('does not read a total and write it back', () => {
    expect(add).not.toMatch(/record\.total_jobs \+ batchableJobs\.length/)
    expect(add).not.toMatch(/record\.pending_jobs \+ batchableJobs\.length/)
  })

  it('goes through the atomic increment instead', () => {
    expect(add).toContain('incrementBatchCounters(this.id, batchableJobs.length)')
  })

  it('increments the redis hash in place, rather than rewriting it', () => {
    // Redis stores a batch as a hash, so HINCRBY is its equivalent of the SQL
    // `column + n`; `hset` of a computed value would carry the same race.
    const fn = src.slice(src.indexOf('async function incrementBatchCounters'))
    expect(fn.slice(0, 800)).toContain('hincrby')
  })
})
