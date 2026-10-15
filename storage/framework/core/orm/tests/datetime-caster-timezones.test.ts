import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * The datetime casters read the same instant in every process timezone.
 *
 * `new Date('2026-10-15T21:22:38.565')` on a literal with no offset is parsed
 * as LOCAL time, so the caster returned a different instant depending on the
 * server's clock. Every datetime a driver hands back as a string went through
 * that branch, which is every datetime column on SQLite, where they are text.
 * Silent: no error, just a value hours away from the one that was stored
 * (stacksjs/stacks#2902).
 *
 * A process cannot change its own zone after start, so each case is its own
 * process. No database: the axis under test is the shape of the value reaching
 * the reader, which is exactly the one the earlier rounds of this bug never
 * varied.
 */
const ZONES = ['UTC', 'Asia/Manila', 'America/Los_Angeles'] as const

/** The literal `sqlDateTime()` writes, and the instant it stands for. */
const STORED = '2026-10-15T21:22:38.565'
const INTENDED = Date.parse('2026-10-15T21:22:38.565Z')

const defineModel = join(import.meta.dir, '..', 'src', 'define-model.ts')

async function casterReadsIn(zone: string, value: 'string' | 'date'): Promise<number> {
  const script = `
    const { builtInCasters } = await import(${JSON.stringify(defineModel)})
    const input = ${value === 'string' ? JSON.stringify(STORED) : `new Date(${INTENDED})`}
    console.log(String(builtInCasters.datetime.get(input).getTime()))
  `
  const proc = Bun.spawn(['bun', '-e', script], {
    cwd: join(import.meta.dir, '..', '..', '..', '..'),
    env: { ...process.env, TZ: zone },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect({ zone, code, err: err.slice(0, 400) }).toMatchObject({ code: 0 })
  return Number(out.trim().split('\n').pop())
}

describe('datetime caster across process timezones (stacksjs/stacks#2902)', () => {
  it('reads a stored literal as the instant it was written for, in every zone', async () => {
    const read = await Promise.all(ZONES.map(zone => casterReadsIn(zone, 'string')))
    expect(Object.fromEntries(ZONES.map((zone, i) => [zone, read[i] - INTENDED])))
      .toEqual({ 'UTC': 0, 'Asia/Manila': 0, 'America/Los_Angeles': 0 })
  }, 60_000)

  it('passes a Date through untouched, which is what a decoding driver returns', async () => {
    const read = await Promise.all(ZONES.map(zone => casterReadsIn(zone, 'date')))
    expect([...new Set(read)]).toEqual([INTENDED])
  }, 60_000)
})
