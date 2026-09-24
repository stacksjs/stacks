import { describe, expect, spyOn, test } from 'bun:test'
import { addMailUser, mailUserClient, parseMailUserPassword, resolveMailUserBackend } from '../src/mail-users'

describe('mailbox user backend selection', () => {
  test.each([undefined, { driver: 'external' as const }])('rejects an unmanaged backend before constructing an AWS client: %j', async (settings) => {
    let calls = 0
    await expect(mailUserClient(settings, async () => { calls++; throw new Error('AWS must not be reached') })).rejects.toThrow('mailboxUsers')
    expect(calls).toBe(0)
  })

  test('uses the explicitly selected AWS table and region, not the application name', () => {
    expect(resolveMailUserBackend({ driver: 'dynamodb', table: 'intentional-mail-users', region: 'eu-west-1' })).toEqual({ table: 'intentional-mail-users', region: 'eu-west-1' })
  })

  test.each(['', 'bad/table', 'ab'])('rejects an invalid table without creating it: %s', (table) => {
    expect(() => resolveMailUserBackend({ driver: 'dynamodb', table })).toThrow('table')
  })

  test('writes only the legacy-compatible hash to the chosen backend', async () => {
    const writes: unknown[] = []
    const regions: string[] = []
    await addMailUser('Fixture@Example.invalid', 'synthetic-password\n', { driver: 'dynamodb', table: 'fixture-mail-users', region: 'eu-west-1' }, async region => {
      regions.push(region)
      return {
        putItem: async input => { writes.push(input); return {} },
        scan: async () => { throw new Error('unexpected scan') },
        deleteItem: async () => { throw new Error('unexpected delete') },
      }
    })
    expect(regions).toEqual(['eu-west-1'])
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ TableName: 'fixture-mail-users', Item: {
      email: { S: 'fixture@example.invalid' },
      passwordHash: { S: 'd7edf5af6b41d1725d40892f976e6cd8ba97046d0e1ffb48365ce759630a4d41' },
    } })
    expect(JSON.stringify(writes)).not.toContain('synthetic-password')
  })

  test('rejects invalid credentials before AWS access', async () => {
    let calls = 0
    const factory = async () => { calls++; throw new Error('AWS must not be reached') }
    const settings = { driver: 'dynamodb' as const, table: 'fixture-mail-users' }
    await expect(addMailUser('bad-address', 'synthetic', settings, factory)).rejects.toThrow('email')
    await expect(addMailUser('fixture@example.invalid', '', settings, factory)).rejects.toThrow('password')
    expect(calls).toBe(0)
  })

  test('does not report success or create a table when the selected verifier rejects a write', async () => {
    await expect(addMailUser('fixture@example.invalid', 'synthetic', { driver: 'dynamodb', table: 'fixture-mail-users' }, async () => ({
      putItem: async () => { throw new Error('ResourceNotFoundException') },
      scan: async () => { throw new Error('unexpected scan') },
      deleteItem: async () => { throw new Error('unexpected delete') },
    }))).rejects.toThrow('ResourceNotFoundException')
  })

  test('does not log credentials on success or failure', async () => {
    const output: unknown[][] = []
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const)
      .map(method => spyOn(console, method).mockImplementation((...args) => { output.push(args) }))
    try {
      for (const fail of [false, true]) {
        const operation = addMailUser('fixture@example.invalid', 'synthetic-secret', { driver: 'dynamodb', table: 'fixture-mail-users' }, async () => ({
          putItem: async () => {
            if (fail) throw new Error('ResourceNotFoundException')
            return {}
          },
          scan: async () => { throw new Error('unexpected scan') },
          deleteItem: async () => { throw new Error('unexpected delete') },
        }))
        if (fail) await expect(operation).rejects.toThrow('ResourceNotFoundException')
        else await expect(operation).resolves.toBeUndefined()
      }
      expect(output).toEqual([])
    }
    finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})

describe('mail user password input', () => {
  test('removes one terminal newline, not meaningful password whitespace', () => {
    expect(parseMailUserPassword(' space matters \r\n')).toBe(' space matters ')
  })
  test.each(['', '\n', 'one\ntwo', 'one\rsecret', 'x'.repeat(1025)])('rejects empty, multiline or excessive input', (input) => {
    expect(() => parseMailUserPassword(input)).toThrow('password')
  })
})
