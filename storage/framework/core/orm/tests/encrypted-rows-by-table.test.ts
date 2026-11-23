import { beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import process from 'node:process'
import { decryptRow, decryptRows, encryptedColumns, encryptRow, isEncrypted } from '../src'
import { defineModel } from '../src/define-model'

// stacksjs/stacks#3359. A model's `encrypted: true` attributes are encrypted
// on the model's own writes, but code that writes through the query builder
// (`db.insertInto('table').values(row)`) bypassed them and stored plaintext.
// The query builder has no row hooks, so the documented path is a helper that
// knows each table's encrypted columns.

beforeAll(() => {
  process.env.APP_KEY ??= 'base64:dGVzdC1rZXktZm9yLWVuY3J5cHRlZC1yb3dzLXRlc3RzLTEyMzQ='
  defineModel({
    name: 'EncryptedRowsProbe',
    table: 'encrypted_rows_probes',
    attributes: {
      name: { fillable: true },
      apiToken: { fillable: true, encrypted: true },
      refreshSecret: { fillable: true, encrypted: true },
    },
  } as never)
  defineModel({
    name: 'PlainRowsProbe',
    table: 'plain_rows_probes',
    attributes: { name: { fillable: true } },
  } as never)
})

describe('a table\'s encrypted columns', () => {
  test('are the model\'s encrypted attributes, as columns', () => {
    expect(encryptedColumns('encrypted_rows_probes').sort()).toEqual(['api_token', 'refresh_secret'])
    expect(encryptedColumns('plain_rows_probes')).toEqual([])
  })

  test('a table no model defines is refused, not treated as having none', () => {
    expect(() => encryptedColumns('no_such_table')).toThrow('no model defines the table')
  })
})

describe('rows written and read through the query builder', () => {
  test('encryptRow encrypts the encrypted columns, by column or attribute name, and nothing else', async () => {
    const row = await encryptRow('encrypted_rows_probes', { name: 'Postline', api_token: 'tok-123', refreshSecret: 'rs-456' })
    expect(row.name).toBe('Postline')
    expect(isEncrypted(row.api_token)).toBe(true)
    expect(isEncrypted(row.refreshSecret)).toBe(true)
    expect(String(row.api_token)).not.toContain('tok-123')
  })

  test('decryptRow and decryptRows give the plaintext back', async () => {
    const stored = await encryptRow('encrypted_rows_probes', { name: 'Postline', api_token: 'tok-123', refresh_secret: 'rs-456' })
    expect(await decryptRow('encrypted_rows_probes', stored)).toEqual({ name: 'Postline', api_token: 'tok-123', refresh_secret: 'rs-456' })
    expect(await decryptRows('encrypted_rows_probes', [stored, stored])).toHaveLength(2)
  })

  test('encrypting twice does not double-encrypt', async () => {
    const once = await encryptRow('encrypted_rows_probes', { api_token: 'tok-123' })
    const twice = await encryptRow('encrypted_rows_probes', once)
    expect(twice.api_token).toBe(once.api_token)
  })

  test('a table without encrypted columns passes rows through', async () => {
    expect(await encryptRow('plain_rows_probes', { name: 'x' })).toEqual({ name: 'x' })
  })
})

test('a row stored with encryptRow is ciphertext in the database and plaintext through decryptRow', async () => {
  const database = new Database(':memory:')
  try {
    database.run('CREATE TABLE encrypted_rows_probes (id INTEGER PRIMARY KEY, name TEXT, api_token TEXT, refresh_secret TEXT)')
    const row = await encryptRow('encrypted_rows_probes', { name: 'Postline', api_token: 'tok-123', refresh_secret: 'rs-456' })
    database.query('INSERT INTO encrypted_rows_probes (name, api_token, refresh_secret) VALUES ($name, $api_token, $refresh_secret)')
      .run({ $name: row.name as string, $api_token: row.api_token as string, $refresh_secret: row.refresh_secret as string })

    const stored = database.query('SELECT name, api_token, refresh_secret FROM encrypted_rows_probes').get() as Record<string, unknown>
    expect(stored.name).toBe('Postline')
    expect(isEncrypted(stored.api_token)).toBe(true)
    expect(JSON.stringify(stored)).not.toContain('tok-123')
    expect(await decryptRow('encrypted_rows_probes', stored)).toEqual({ name: 'Postline', api_token: 'tok-123', refresh_secret: 'rs-456' })
  }
  finally { database.close() }
})
