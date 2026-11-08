import { describe, expect, test } from 'bun:test'
import { ensureHashed } from '../src/commands/user'

/** One account's password column, in memory. */
function column(initial: string) {
  let value = initial
  const writes: string[] = []
  return {
    writes,
    get value() { return value },
    read: async () => value,
    write: async (_address: string, hash: string) => { writes.push(hash); value = hash },
  }
}

/**
 * `buddy user:add --update` reset a password with a query-builder update,
 * which runs no model setter, and stored it exactly as typed. Whatever path
 * wrote it, the command now leaves a verifying hash or fails.
 */
describe('user:add password storage', () => {
  test('replaces a password stored as typed with a bcrypt hash that verifies', async () => {
    const stored = column('synthetic-Passw0rd')
    await ensureHashed('fixture@example.invalid', 'synthetic-Passw0rd', stored)
    expect(stored.writes).toHaveLength(1)
    expect(stored.value).toMatch(/^\$2[aby]\$/)
    expect(stored.value).not.toContain('synthetic-Passw0rd')
    expect(await Bun.password.verify('synthetic-Passw0rd', stored.value)).toBe(true)
  })

  test('leaves a hash the model setter already wrote alone', async () => {
    const hash = await Bun.password.hash('synthetic-Passw0rd', { algorithm: 'bcrypt', cost: 4 })
    const stored = column(hash)
    await ensureHashed('fixture@example.invalid', 'synthetic-Passw0rd', stored)
    expect(stored.writes).toHaveLength(0)
    expect(stored.value).toBe(hash)
  })

  test('fails rather than report success when the stored hash is of something else', async () => {
    const stored = column(await Bun.password.hash('another-password', { algorithm: 'bcrypt', cost: 4 }))
    await expect(ensureHashed('fixture@example.invalid', 'synthetic-Passw0rd', stored)).rejects.toThrow('does not verify')
  })
})
