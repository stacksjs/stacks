/**
 * `buddy user:audit` lists accounts whose name looks like an advert, so an
 * operator can review them. It lists; it never changes or removes a row.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { suspectAccounts } from '../src/commands/user'

const rows = [
  { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', email_verified_at: '2026-11-01 10:00:00' },
  { id: 2, email: 'throwaway1@example.net', name: 'KAZAN 70.000 TL bonus bit.ly/3xQ', email_verified_at: null },
  { id: 3, email: 'short@example.com', name: 'A' },
  { id: 4, email: 'none@example.com', name: null },
  { id: 5, email: 'long@example.com', name: 'word '.repeat(40) },
  { id: 6, email: 'markup@example.com', name: '<b>Free</b>\nmoney', email_verified_at: '2026-11-02 10:00:00' },
  { id: 7, email: 'initials@example.com', name: 'J.R.R. Tolkien' },
]

describe('suspectAccounts', () => {
  test('lists the accounts registration would refuse today, links first', async () => {
    const suspects = await suspectAccounts(rows)

    expect(suspects.map(account => [account.id, account.reason])).toEqual([
      [2, 'link in name'],
      [6, 'control characters in name'],
      [5, 'name too long'],
    ])
  })

  test('says whether the address was ever confirmed', async () => {
    const suspects = await suspectAccounts(rows)

    expect(suspects.find(account => account.id === 2)?.verified).toBe(false)
    expect(suspects.find(account => account.id === 6)?.verified).toBe(true)
  })

  test('prints a name on one line and bounded', async () => {
    const [markup] = (await suspectAccounts(rows)).filter(account => account.id === 6)
    const [long] = (await suspectAccounts(rows)).filter(account => account.id === 5)

    expect(markup?.name).not.toContain('\n')
    expect(long?.name.length).toBeLessThanOrEqual(120)
  })

  test('leaves a missing or one-letter name alone: untidy is not an advert', async () => {
    const ids = (await suspectAccounts(rows)).map(account => account.id)

    expect(ids).not.toContain(3)
    expect(ids).not.toContain(4)
    expect(ids).not.toContain(7)
  })
})

describe('buddy user:audit', () => {
  const source = readFileSync(join(import.meta.dir, '../src/commands/user.ts'), 'utf8')
  const command = source.slice(source.indexOf(`.command('user:audit'`))

  test('is registered for lazy loading', () => {
    expect(readFileSync(join(import.meta.dir, '../src/lazy-commands.ts'), 'utf8')).toContain(`'user:audit':`)
  })

  test('only reads', () => {
    expect(command.length).toBeGreaterThan(0)
    expect(command).not.toMatch(/deleteFrom|updateTable|insertInto|\.delete\(|\.update\(|\.create\(/)
  })
})
