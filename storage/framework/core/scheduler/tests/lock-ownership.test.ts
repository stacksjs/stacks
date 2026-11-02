import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireSchedulerLock } from '../src/scheduler-lock'

test('an expired owner cannot release a replacement lease', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lock-owner-'))
  const realNow = Date.now
  const now = realNow()
  try {
    Date.now = () => now
    const original = await acquireSchedulerLock('task', 1000, null, null, directory)
    assertHandle(original)
    Date.now = () => now + 2000
    const replacement = await acquireSchedulerLock('task', 1000, null, null, directory)
    assertHandle(replacement)
    await original.release()
    expect(await acquireSchedulerLock('task', 1000, null, null, directory)).toBeNull()
    await replacement.release()
    const next = await acquireSchedulerLock('task', 1000, null, null, directory)
    assertHandle(next)
    await replacement.release()
    expect(await acquireSchedulerLock('task', 1000, null, null, directory)).toBeNull()
    await next.release()
  }
  finally { Date.now = realNow; await rm(directory, { recursive: true, force: true }) }
})

function assertHandle<T>(value: T | null): asserts value is T {
  expect(value).not.toBeNull()
  if (value === null) throw new Error('Expected a lock handle')
}

test('distinct MySQL task names cannot share a sanitized advisory lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-mysql-lock-'))
  const held = new Set<string>()
  const service = { async unsafe(sql: string) {
    const name = /\('([^']+)'/.exec(sql)?.[1] ?? ''
    if (sql.includes('GET_LOCK')) {
      if (held.has(name)) return [{ acquired: 0 }]
      held.add(name)
      return [{ acquired: 1 }]
    }
    held.delete(name)
    return []
  } }
  try {
    const a = await acquireSchedulerLock('send-email', 60_000, 'mysql', service, directory)
    const b = await acquireSchedulerLock('send_email', 60_000, 'mysql', service, directory)
    assertHandle(a); assertHandle(b)
    await a.release(); await b.release()
    expect(held.size).toBe(0)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
