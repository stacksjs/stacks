/**
 * What a payload is worth once it has been through JSON
 * (stacksjs/stacks#2282, item 6).
 *
 * The envelope travels as JSON, so a payload is subject to JSON's type system
 * and not JavaScript's: `undefined` is dropped, a `Date` flattens to a string,
 * a `Map` becomes `{}` — and a `BigInt` throws from inside `JSON.stringify`,
 * taking the dispatch with it and naming neither the job nor the property.
 *
 * Three things are pinned here: the round-trip contract itself, so a future
 * "helpful" serializer cannot quietly change what a worker sees; the guard that
 * turns that TypeError into a message an operator can act on, INCLUDING which
 * of its messages a given failure earns; and the wiring, driven through the
 * dispatch APIs rather than asserted against the source text — the first cut of
 * this file grepped `src/job.ts` for a string literal and stayed green while
 * `src/action.ts`, the path `docs/basics/jobs.md` teaches, was still
 * hand-stringifying.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { Job } from '../src/action'
import {
  assertEnvelopeSerializable,
  createEnvelope,
  parseEnvelope,
  serializeEnvelope,
} from '../src/envelope'
import { job } from '../src/job'
import { overlapPayloadPattern } from '../src/scheduler-persistence'
import { buildScheduledJobRow, storeJob } from '../src/utils'

/** Dispatch and receive, the way a database-driver worker actually does. */
function roundTrip(payload: unknown): any {
  const parsed = parseEnvelope(serializeEnvelope(createEnvelope('RoundTrip', payload)))
  if (!parsed.ok)
    throw new Error(`envelope did not parse: ${parsed.reason}`)
  return parsed.envelope.payload
}

/*
 * The error a call failed with, rather than `.toThrow(/x/)`.
 *
 * Every assertion below wants several substrings out of one message, and the
 * ones about what a message must NOT say only mean anything when they read the
 * same error object the positive assertions did.
 */
const NOTHING_THROWN = Symbol('nothing thrown')

function failureOf(run: () => unknown): Error {
  try {
    run()
  }
  catch (err) {
    return err as Error
  }
  throw new Error('expected the call to fail, but it completed')
}

async function rejectionOf(run: () => unknown | Promise<unknown>): Promise<Error> {
  let caught: unknown = NOTHING_THROWN
  try {
    await run()
  }
  catch (err) {
    caught = err
  }
  if (caught === NOTHING_THROWN)
    throw new Error('expected the dispatch to fail, but it completed')
  return caught as Error
}

/** A payload no driver can put on the wire, with a path worth naming. */
function unserializablePayload(): Record<string, unknown> {
  return { invoice: { cents: 9007199254740993n } }
}

describe('serializeEnvelope', () => {
  it('writes exactly the JSON a bare stringify would, for a payload JSON can hold', () => {
    const envelope = createEnvelope('SendInvoice', { orderId: 42, lines: ['a', 'b'] }, { tries: 3 })

    expect(serializeEnvelope(envelope)).toBe(JSON.stringify(envelope))
  })

  it('names the job, the property and the way out when the payload holds a BigInt', () => {
    const envelope = createEnvelope('ChargeInvoice', { invoice: { cents: 9007199254740993n } })

    expect(() => serializeEnvelope(envelope)).toThrow(/payload\.invoice\.cents/)
    expect(() => serializeEnvelope(envelope)).toThrow(/ChargeInvoice/)
    expect(() => serializeEnvelope(envelope)).toThrow(/BigInt/)
  })

  it('says something a bare JSON.stringify never could', () => {
    /*
     * The whole point of the guard. Bun's own message is
     * `JSON.stringify cannot serialize BigInt.` — true, and useless: an
     * operator reading it in production learns neither which job failed to
     * dispatch nor which property to convert.
     */
    const envelope = createEnvelope('ChargeInvoice', { cents: 1n })

    let raw = ''
    try {
      JSON.stringify(envelope)
    }
    catch (err) {
      raw = (err as Error).message
    }
    expect(raw).toContain('BigInt')
    expect(raw).not.toContain('ChargeInvoice')
    expect(raw).not.toContain('cents')

    const guarded = failureOf(() => serializeEnvelope(envelope)).message
    expect(guarded).toContain('ChargeInvoice')
    expect(guarded).toContain('payload.cents')
    expect(guarded).toContain('String(value)')
  })

  it('walks into arrays, so a BigInt in the tenth item is still findable', () => {
    const envelope = createEnvelope('Settle', { invoices: [{ cents: 1 }, { cents: 2n }] })

    expect(() => serializeEnvelope(envelope)).toThrow(/payload\.invoices\[1\]\.cents/)
  })

  it('names the payload itself when the payload IS a BigInt', () => {
    expect(() => serializeEnvelope(createEnvelope('Settle', 7n))).toThrow(/`payload` is a BigInt/)
  })

  it('finds a BigInt hiding in the options too, not just the payload', () => {
    const envelope = createEnvelope('Settle', {}, { timeout: 30n as unknown as number })

    expect(() => serializeEnvelope(envelope)).toThrow(/options\.timeout/)
  })

  it('keeps the original TypeError as `cause`, for whoever is reading a stack', () => {
    const err = failureOf(() => serializeEnvelope(createEnvelope('Settle', { cents: 1n })))

    expect((err as Error & { cause?: unknown }).cause).toBeInstanceOf(TypeError)
  })

  it('still explains itself when a cyclic payload also contains a BigInt', () => {
    // Cycle-blind recursion would never return here.
    const cyclic: Record<string, unknown> = { cents: 5n }
    cyclic.self = cyclic

    expect(() => serializeEnvelope(createEnvelope('Settle', cyclic))).toThrow(/payload\.cents/)
  })
})

/*
 * Which message a failure earns is decided by the CAUSE, never by what a walk
 * of the payload happens to find (stacksjs/stacks#2282 item 6).
 *
 * The first cut asked only "is there a BigInt anywhere in this graph?", and
 * appended "a circular reference is the usual cause" to everything else. It
 * therefore misdiagnosed both of the first two failures below, sending the
 * operator to convert a property that was serializing perfectly well, or to
 * hunt a cycle that was never there.
 */
describe('the diagnosis follows the actual failure', () => {
  it('blames the code that threw, not a BigInt that merely happens to be nearby', () => {
    /*
     * Key order matters: `JSON.stringify` reaches `report` first and never gets
     * as far as `id`, so the BigInt is a bystander to this failure.
     */
    const payload = {
      report: { toJSON(): never { throw new Error('report unavailable') } },
      id: 9007199254740993n,
    }

    const err = failureOf(() => serializeEnvelope(createEnvelope('NightlyReport', payload)))

    expect(err.message).toContain('NightlyReport')
    expect(err.message).toContain('report unavailable')
    expect(err.message).not.toContain('is a BigInt')
    expect(err.message).not.toContain('payload.id')
  })

  it('does not assert a circular reference for a failure that plainly is not one', () => {
    // A throwing getter is neither of JSON's own two failures. Naming a cause
    // for it was a guess, and the guess was wrong.
    const payload = {
      get amount(): number { throw new Error('getter exploded') },
    }

    const err = failureOf(() => serializeEnvelope(createEnvelope('Settle', payload)))

    expect(err.message).toContain('getter exploded')
    expect(err.message).not.toMatch(/circular/i)
    expect(err.message).not.toMatch(/cyclic/i)
  })

  it('reports a circular payload as what it is, rather than blaming a BigInt', () => {
    /*
     * The other way JSON itself throws. The diagnosis walk has to terminate on
     * the very structure that caused the failure — a cycle-blind walk would
     * hang the dispatch instead of explaining it.
     */
    const cyclic: Record<string, unknown> = { name: 'loop' }
    cyclic.self = cyclic

    const err = failureOf(() => serializeEnvelope(createEnvelope('Settle', cyclic)))

    expect(err.message).toContain('Settle')
    expect(err.message).toMatch(/circular reference/i)
    expect(err.message).not.toContain('is a BigInt')
  })

  it('still says BigInt, and only BigInt, when the BigInt is what threw', () => {
    const err = failureOf(() => serializeEnvelope(createEnvelope('ChargeInvoice', { cents: 1n })))

    expect(err.message).toContain('payload.cents')
    expect(err.message).not.toMatch(/circular/i)
  })
})

describe('assertEnvelopeSerializable', () => {
  it('passes a clean envelope through silently', () => {
    expect(() => assertEnvelopeSerializable(createEnvelope('SendInvoice', { orderId: 1 }))).not.toThrow()
  })

  it('raises the same actionable error for the drivers that serialize elsewhere', () => {
    // The redis path hands the object to bun-queue, which stringifies it out
    // of our sight; without this the failure surfaces as the bare TypeError.
    expect(() => assertEnvelopeSerializable(createEnvelope('ChargeInvoice', { cents: 2n })))
      .toThrow(/payload\.cents/)
  })
})

describe('the documented round trip', () => {
  it('drops an undefined property entirely', () => {
    const payload = roundTrip({ a: 1, b: undefined })

    expect(payload).toEqual({ a: 1 })
    expect('b' in payload).toBe(false)
  })

  it('turns an undefined array element into null instead of dropping it', () => {
    expect(roundTrip({ ids: [1, undefined, 3] })).toEqual({ ids: [1, null, 3] })
  })

  it('flattens a Date to an ISO string, and does not revive it', () => {
    const when = new Date('2026-08-07T12:00:00.000Z')
    const payload = roundTrip({ when })

    expect(payload.when).toBe('2026-08-07T12:00:00.000Z')
    expect(payload.when instanceof Date).toBe(false)
  })

  it('empties a Map and a Set into {}', () => {
    const payload = roundTrip({ m: new Map([['a', 1]]), s: new Set([1, 2]) })

    expect(payload.m).toEqual({})
    expect(payload.s).toEqual({})
  })

  it('strips a class instance down to its own enumerable properties', () => {
    class Invoice {
      constructor(public id: number) {}
      total(): number {
        return this.id * 100
      }
    }
    const payload = roundTrip({ invoice: new Invoice(7) })

    expect(payload.invoice).toEqual({ id: 7 })
    expect(typeof payload.invoice.total).toBe('undefined')
    expect(payload.invoice instanceof Invoice).toBe(false)
  })

  it('drops functions and symbol values', () => {
    const payload = roundTrip({ keep: 1, fn: () => 'nope', sym: Symbol('nope') })

    expect(payload).toEqual({ keep: 1 })
  })

  it('turns NaN and the infinities into null, and -0 into 0', () => {
    const payload = roundTrip({ nan: Number.NaN, inf: Infinity, negInf: -Infinity, negZero: -0 })

    expect(payload.nan).toBeNull()
    expect(payload.inf).toBeNull()
    expect(payload.negInf).toBeNull()
    expect(Object.is(payload.negZero, 0)).toBe(true)
  })

  it('loses precision on an integer past 2^53 without any error at all', () => {
    // The silent version of the BigInt failure, and the reason large ids
    // belong in a payload as strings.
    expect(roundTrip({ id: 9007199254740993 }).id).toBe(9007199254740992)
    expect(roundTrip({ id: '9007199254740993' }).id).toBe('9007199254740993')
  })

  it('carries plain JSON data, and key order, through unchanged', () => {
    const payload = roundTrip({ z: 'last', a: true, n: null, nested: { list: [1, 'two', false] } })

    expect(payload).toEqual({ z: 'last', a: true, n: null, nested: { list: [1, 'two', false] } })
    expect(Object.keys(payload)).toEqual(['z', 'a', 'n', 'nested'])
  })
})

/*
 * Wiring, exercised rather than grepped.
 *
 * Each test drives a real dispatch entry point with a payload no driver can
 * put on the wire, and reads the error it comes back with. That is the only
 * behaviour that distinguishes the guard from a bare `JSON.stringify`: on a
 * payload JSON CAN hold, the two produce byte-identical output (pinned at the
 * top of this file), so the failure is where the wiring is observable.
 *
 * None of these reach a database or a Redis socket, because each guard now
 * runs before its driver acquires anything — which is the same property the
 * "before the connection is open" claim in the source depends on.
 */
const BAD = 'payload.invoice.cents'

/**
 * Run `fn` with `QUEUE_DRIVER` forced, then put the environment back exactly as
 * it was — `@stacksjs/env` reads `process.env` live, so leaving it set would
 * re-route every dispatch in every test file after this one.
 */
async function withQueueDriver<T>(driver: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.QUEUE_DRIVER
  process.env.QUEUE_DRIVER = driver
  try {
    return await fn()
  }
  finally {
    if (previous === undefined)
      delete process.env.QUEUE_DRIVER
    else
      process.env.QUEUE_DRIVER = previous
  }
}

/**
 * Run `fn` with the redis connection missing from the live config.
 *
 * This is what makes "the guard runs BEFORE the driver is touched" testable
 * without a Redis server: `dispatchToRedis` throws
 * `Redis queue connection is not configured` the moment it reads that config,
 * which is itself before it constructs the queue and opens a socket. So a run
 * that comes back with the payload error instead proves the guard beat the
 * config read — and therefore beat the connection too. With the guard sitting
 * after `new RedisQueue(...)`, the config error is what surfaces.
 */
async function withoutRedisConfig<T>(fn: () => Promise<T>): Promise<T> {
  const { queue: queueConfig } = await import('@stacksjs/config')
  const connections = (queueConfig as any)?.connections
  const saved = connections?.redis
  if (connections)
    delete connections.redis
  try {
    return await fn()
  }
  finally {
    if (connections && saved !== undefined)
      connections.redis = saved
  }
}

describe('every dispatch path refuses an unserializable payload, actionably (#2282 item 6)', () => {
  describe('`class X extends Job` / `new Job({...})` - the form the docs teach', () => {
    it('names the job and the property instead of letting JSON throw, on the database driver', async () => {
      const err = await withQueueDriver('database', () =>
        rejectionOf(() => new Job({ name: 'ChargeInvoice' }).dispatch(unserializablePayload())))

      expect(err.message).toContain('ChargeInvoice')
      expect(err.message).toContain(BAD)
      // The bare failure this replaces, kept as the `cause` for stack readers.
      expect(err).not.toBeInstanceOf(TypeError)
      expect((err as Error & { cause?: unknown }).cause).toBeInstanceOf(TypeError)
    })

    it('does the same on the redis driver, before it so much as reads the connection config', async () => {
      const err = await withQueueDriver('redis', () => withoutRedisConfig(() =>
        rejectionOf(() => new Job({ name: 'ChargeInvoice' }).dispatch(unserializablePayload()))))

      expect(err.message).toContain('ChargeInvoice')
      expect(err.message).toContain(BAD)
      expect(err.message).not.toContain('not configured')
    })

    it('guards the delayed dispatch too, which routes to the drivers separately', async () => {
      const err = await withQueueDriver('database', () =>
        rejectionOf(() => new Job({ name: 'ChargeInvoice' }).dispatchAfter(60, unserializablePayload())))

      expect(err.message).toContain(BAD)
    })
  })

  describe('`job(name, payload)` - the fluent builder', () => {
    /*
     * Driven at the driver methods rather than through `dispatch()`: the
     * builder's pipeline consults the quarantine table first, so going in at
     * the top would make these tests depend on a migrated database for a
     * property that has nothing to do with one.
     */
    it('names the job and the property on the database driver', async () => {
      const builder = job('ChargeInvoice', unserializablePayload()) as any
      const err = await rejectionOf(() => builder.dispatchToDatabase())

      expect(err.message).toContain('ChargeInvoice')
      expect(err.message).toContain(BAD)
    })

    it('names them on the redis driver, before it reads the connection config', async () => {
      const builder = job('ChargeInvoice', unserializablePayload()) as any
      const err = await withoutRedisConfig(() => rejectionOf(() => builder.dispatchToRedis()))

      expect(err.message).toContain('ChargeInvoice')
      expect(err.message).toContain(BAD)
      expect(err.message).not.toContain('not configured')
    })
  })

  describe('`storeJob` - the writer behind every scheduled dispatch', () => {
    it('fails with the job name and the property, not a bare TypeError from a cron tick', async () => {
      const err = await rejectionOf(() => storeJob('NightlyRollup', {
        queue: 'cron',
        payload: unserializablePayload(),
        maxTries: 3,
      }))

      expect(err.message).toContain('NightlyRollup')
      expect(err.message).toContain(BAD)
      expect(err).not.toBeInstanceOf(TypeError)
    })
  })
})

/*
 * The scheduler's row, checked without a database.
 *
 * `storeJob` used to hand-build its own envelope-shaped object, which was — key
 * for key — the PRE-#1884 v0 shape. So every scheduled dispatch landed in the
 * table looking like a job queued before the upgrade, and the worker read it
 * down the back-compat branch. Routing it through `createEnvelope` is the fix;
 * these assert the shape it now writes.
 */
describe('a scheduled job is written as a current-version envelope (#2282 item 6)', () => {
  it('parses as v1, not as the pre-#1884 shape the back-compat branch handles', () => {
    const row = buildScheduledJobRow('NightlyRollup', { queue: 'cron', payload: { day: '2026-08-10' }, maxTries: 3, timeout: 90 })
    const parsed = parseEnvelope(row.payload)

    expect(parsed.ok).toBe(true)
    expect(parsed.ok && parsed.source).toBe('v1')
  })

  it('carries a real dispatchedAt, which is what "this job sat in the queue for X" is measured from', () => {
    const before = Date.now()
    const row = buildScheduledJobRow('NightlyRollup', { queue: 'cron', payload: {} })
    const envelope = JSON.parse(row.payload)

    // The v0 shape had no such field, so the parser substituted the epoch —
    // every scheduled job appeared to have been waiting since 1970.
    expect(Date.parse(envelope.dispatchedAt)).toBeGreaterThanOrEqual(before - 1000)
    expect(envelope.dispatchedAt).not.toContain('1970')
  })

  it('keeps carrying the name, payload and per-job options the worker applies', () => {
    const row = buildScheduledJobRow('NightlyRollup', {
      queue: 'cron',
      payload: { day: '2026-08-10' },
      maxTries: 5,
      timeout: 90,
      backoff: [10, 30],
    })
    const parsed = parseEnvelope(row.payload)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok)
      return
    expect(parsed.envelope.jobName).toBe('NightlyRollup')
    expect(parsed.envelope.payload).toEqual({ day: '2026-08-10' })
    expect(parsed.envelope.options).toEqual({ queue: 'cron', tries: 5, timeout: 90, backoff: [10, 30] })
    expect(row.queue).toBe('cron')
  })

  it('defaults an absent payload to {} and an absent queue to default, as it always did', () => {
    const row = buildScheduledJobRow('NightlyRollup', {})
    const parsed = parseEnvelope(row.payload)

    expect(row.queue).toBe('default')
    expect(parsed.ok && parsed.envelope.payload).toEqual({})
  })

  /*
   * The one thing the scheduler asks of this row's TEXT.
   *
   * `hasUnfinishedRun` answers "is a previous run of this job still queued?"
   * with `WHERE payload LIKE '%"jobName":"<name>"%' ESCAPE '\'`, because the
   * `jobs` table has no name column. That is a real coupling between the
   * envelope's serialized form and the overlap guard, and it is worth a test —
   * but the property is that the pattern MATCHES, not that any particular
   * source line exists. (`tests/scheduler-persistence.test.ts` pinned it by
   * grepping `src/utils.ts` for `JSON.stringify({ jobName: name,`, whose
   * stated reason — "storeJob puts jobName first" — the pattern's leading `%`
   * makes irrelevant, and which no form of the #2282 guard can leave in place,
   * since the guard is what replaces that `JSON.stringify` call.)
   */
  it('still matches the LIKE pattern the scheduler overlap guard queries with', () => {
    const row = buildScheduledJobRow('backup', { queue: 'cron', payload: { full: true } })

    expect(likeMatches(overlapPayloadPattern('backup'), row.payload)).toBe(true)
  })

  it('does not let a prefix name match a sibling job through that pattern', () => {
    // Without the closing quote in the pattern, `backup` would suppress
    // `backup-daily` and the guard would silently stop dispatching it.
    const sibling = buildScheduledJobRow('backup-daily', { queue: 'cron', payload: {} })

    expect(likeMatches(overlapPayloadPattern('backup'), sibling.payload)).toBe(false)
    expect(likeMatches(overlapPayloadPattern('backup-daily'), sibling.payload)).toBe(true)
  })

  it('keeps underscores in a job name literal, rather than letting LIKE wildcard them', () => {
    // `_` matches any single character in LIKE, so an unescaped `backup_daily`
    // would also match a queued `backupXdaily`.
    const decoy = buildScheduledJobRow('backupXdaily', {})

    expect(likeMatches(overlapPayloadPattern('backup_daily'), decoy.payload)).toBe(false)
    expect(likeMatches(overlapPayloadPattern('backup_daily'), buildScheduledJobRow('backup_daily', {}).payload)).toBe(true)
  })
})

/**
 * SQL `LIKE ... ESCAPE '\'` as a predicate, so the pattern the scheduler hands
 * the database can be checked against a payload without one.
 */
function likeMatches(pattern: string, text: string): boolean {
  const quote = (character: string): string => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const character = pattern[i]
    if (character === '\\') {
      i += 1
      source += quote(pattern[i] ?? '')
    }
    else if (character === '%') {
      source += '[\\s\\S]*'
    }
    else if (character === '_') {
      source += '[\\s\\S]'
    }
    else {
      source += quote(character ?? '')
    }
  }

  return new RegExp(`^${source}$`).test(text)
}

describe('the guard is reachable from the package entry (#2282 item 6)', () => {
  it('exports serializeEnvelope and assertEnvelopeSerializable, and they are the real ones', async () => {
    // Userland has to be able to check a payload before it dispatches;
    // `@stacksjs/queue` re-exported the envelope helpers but not these two, so
    // the only way to ask "will this survive the wire?" was to dispatch it.
    const pkg = await import('../src/index')

    expect(typeof pkg.serializeEnvelope).toBe('function')
    expect(typeof pkg.assertEnvelopeSerializable).toBe('function')

    expect(pkg.serializeEnvelope(pkg.createEnvelope('SendInvoice', { orderId: 1 })))
      .toContain('"envelopeVersion":1')
    expect(() => pkg.assertEnvelopeSerializable(pkg.createEnvelope('ChargeInvoice', unserializablePayload())))
      .toThrow(new RegExp(BAD.replace('.', '\\.')))
  })
})

/*
 * A property of the whole package, checked over the whole package.
 *
 * Its predecessor was called "no dispatch path stringifies an envelope by hand
 * any more" and read `src/job.ts` — one file. `src/action.ts` contained the
 * exact literal it forbade, and it was green. A test that names every file it
 * scanned cannot make that mistake twice.
 */
describe('no dispatch path in @stacksjs/queue hand-stringifies an envelope (#2282 item 6)', () => {
  const srcDir = resolve(__dirname, '..', 'src')

  function tsFilesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory())
        return tsFilesUnder(full)
      return entry.isFile() && entry.name.endsWith('.ts') ? [full] : []
    })
  }

  const files = tsFilesUnder(srcDir).map(path => ({
    name: relative(srcDir, path),
    text: readFileSync(path, 'utf-8'),
  }))

  it('actually walks the package, so an empty scan cannot pass', () => {
    expect(files.length).toBeGreaterThanOrEqual(20)
    for (const expected of ['action.ts', 'dead-letter.ts', 'envelope.ts', 'job.ts', 'utils.ts', 'worker.ts', 'drivers/redis.ts'])
      expect(files.map(f => f.name)).toContain(expected)
  })

  it('every module that mints an envelope puts it on the wire through the guard', () => {
    const minters = files.filter(f => f.name !== 'envelope.ts' && /\bcreateEnvelope\(/.test(f.text))

    // Named rather than merely counted: a new dispatch path is exactly the
    // event this test exists to catch, and it should have to be added here.
    expect(minters.map(f => f.name).sort()).toEqual(['action.ts', 'job.ts', 'utils.ts'])

    for (const f of minters) {
      expect(f.text).not.toMatch(/JSON\.stringify\(\s*envelope\b/)
      expect(f.text).toMatch(/\b(?:serializeEnvelope|assertEnvelopeSerializable)\(/)
    }
  })

  it('the remaining writers of jobs.payload only re-queue a payload the guard already passed', () => {
    const writers = files.filter(f => f.text.includes('insertInto(\'jobs\')')).map(f => f.name).sort()

    // `worker.ts` (operator retry of a failed job) and `dead-letter.ts` (DLQ
    // retry) re-enqueue a string read back OUT of the database — `JSON.parse`
    // produced it, so it can hold neither a BigInt nor a cycle, and there is
    // nothing for the guard to catch. Any other name appearing here is a new
    // dispatch path that has not been through it.
    expect(writers).toEqual(['action.ts', 'dead-letter.ts', 'job.ts', 'utils.ts', 'worker.ts'])
  })
})
