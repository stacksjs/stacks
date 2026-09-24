/**
 * query_logs.bindings must not hold credentials, and query_logs.error must not
 * hold the values the bindings withhold where a driver printed them. See
 * src/query-log-bindings.ts for the policy, and what it cannot recognise, and
 * fixtures/query-log-bindings.ts and fixtures/query-log-errors.ts for what the
 * runners do.
 *
 * The unit cases pin the policy on SQL as each dialect's builder writes it.
 * The runners send real queries through the query builder and read back what
 * the logger persisted, each dialect in its own disposable database. A server
 * case runs when STACKS_TEST_POSTGRES_URL / STACKS_TEST_MYSQL_URL is set and
 * skips when it is not. CI sets both, so it runs all three dialects; a laptop
 * without them runs SQLite alone. A URL whose host is not local fails its
 * case rather than skipping it, since the case would create and drop a
 * database there.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'
import { describe, expect, it, test } from 'bun:test'
import { isSensitiveName, looksLikeCredential, MAX_QUERY_LOG_ERROR_LENGTH, parseCaptureBindings, parseSensitiveColumn, persistQueryLogValues, queryLogBindings, serializeQueryLogBindings } from '../src/query-log-bindings'

const SESSION_ID = 'c0ffee00deadbeef'.repeat(4)
const capture = { captureValues: true }

describe('query log bindings', () => {
  it('redacts values bound to sensitive columns in every placeholder style', () => {
    expect(queryLogBindings('UPDATE "users" SET "password" = ?, "remember_token" = ? WHERE "id" = ?', ['hunter2', 'abc', 4], capture))
      .toEqual(['<redacted>', '<redacted>', 4])
    expect(queryLogBindings('UPDATE "users" SET "password" = $2 WHERE "id" = $1', [4, 'hunter2'], capture))
      .toEqual([4, '<redacted>'])
    expect(queryLogBindings('INSERT INTO `users`(`name`,`api_key`,`otp`)VALUES(?,?,?),(?,?,?)', ['Ada', 'k1', 123456, 'Bob', 'k2', 654321], capture))
      .toEqual(['Ada', '<redacted>', '<redacted>', 'Bob', '<redacted>', '<redacted>'])
    expect(queryLogBindings(
      'SELECT * FROM users WHERE lower("email") = lower(?) AND "users"."two_factor_secret" NOT IN (?, ?) AND otp_code IS NOT ? AND created_at BETWEEN ? AND ?',
      ['a@example.com', 's1', 's2', 42, '2026-01-01', '2026-02-01'],
      capture,
    )).toEqual(['a@example.com', '<redacted>', '<redacted>', '<redacted>', '2026-01-01', '2026-02-01'])
    expect(queryLogBindings('SELECT * FROM users WHERE ? = rememberToken', ['abc'], capture)).toEqual(['<redacted>'])
    expect(queryLogBindings('SELECT * FROM users WHERE token = ANY($1)', [['t1', 't2']], capture)).toEqual(['<redacted>'])
    expect(queryLogBindings('INSERT INTO t (a) VALUES (?) ON DUPLICATE KEY UPDATE password = ?', ['x', 'y'], capture))
      .toEqual(['x', '<redacted>'])
  })

  it('treats every text value on a sensitive table as a credential', () => {
    // The session id is bound to a column called `id`: only the table says what it is.
    expect(queryLogBindings('SELECT * FROM sessions WHERE id = ?', ['plain-looking-id'], capture)).toEqual(['<redacted>'])
    expect(queryLogBindings('DELETE FROM "password_resets" WHERE "email" = $1', ['a@example.com'], capture)).toEqual(['<redacted>'])
    expect(queryLogBindings('SELECT * FROM sessions WHERE user_id = ? LIMIT ?', [7, 1], capture)).toEqual([7, 1])
  })

  it('redacts credential-shaped values wherever they are bound', () => {
    const shaped = [
      SESSION_ID,
      'Zq7xT2mN9pL4vR8sK1wY6bH3jF5cD0gA-u_EeIiOo2k',
      '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
      '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA',
      // Assembled here so no secret scanner mistakes the fixtures for real keys.
      [{ alg: 'HS256' }, { sub: 'fixture-user' }].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.signature',
      ['sk', 'live', '0'.repeat(24)].join('_'),
      `AKIA${'0'.repeat(16)}`,
      `https://example.com/reset?token=${SESSION_ID}`,
      `laravel_session_${SESSION_ID}`,
    ]
    for (const value of shaped) {
      expect(looksLikeCredential(value)).toBe(true)
      expect(queryLogBindings('SELECT * FROM posts WHERE title = ?', [value], capture)).toEqual(['<redacted>'])
    }
    expect(queryLogBindings('SELECT * FROM posts WHERE meta = ?', [{ nested: { value: SESSION_ID } }], capture)).toEqual(['<redacted>'])
  })

  it('redacts structured values that carry a sensitive key, whatever column they meet', () => {
    const update = 'UPDATE "people" SET "settings" = ? WHERE "id" = ?'
    const keyed = [
      { theme: 'dark', api_key: 'k1' },
      { provider: { name: 'mail', client_secret: 'plain' } },
      [{ label: 'primary', accessToken: 'abc' }],
      { 'two-factor': { recovery_codes: ['a', 'b'] } },
      '{"theme":"dark","password":"hunter2"}',
      '[{"label":"primary","token":"abc"}]',
      { url: '/hook', headers: { Authorization: 'Basic dTpw' } },
      { billing: { credit_card: '4242' } },
      // Cut off by a column limit, and so no longer JSON.parse-able.
      '{"theme":"dark","api_key":"k1","notes":"lo',
      'payload: {"webhook_secret": "plain"}',
      // JSON encoded inside a JSON string, once and twice over.
      { job: 'SendMail', payload: JSON.stringify({ reset_token: 'abc' }) },
      JSON.stringify(JSON.stringify({ password: 'hunter2' })),
      JSON.stringify({ outer: JSON.stringify({ inner: JSON.stringify({ secret: 'x' }) }) }),
    ]
    for (const value of keyed)
      expect(queryLogBindings(update, [value, 1], capture)).toEqual(['<redacted>', 1])

    // A sensitive word as a value, or in a key that is not sensitive, is kept.
    const plain = [
      { theme: 'dark', keyword: 'password', tokenizer: 'icu' },
      '{"field":"password","rule":"required"}',
      '{"theme":"dark"}',
      '{not json',
      '{"a":":b","note":"x\\"y"}',
    ]
    for (const value of plain)
      expect(queryLogBindings(update, [value, 1], capture)).toEqual([value, 1])
  })

  it('reads the keys of a long encoded JSON value', () => {
    // 20,000 fields encoded inside a JSON string, about 618 KB. A pattern
    // matching whole quoted strings spent 2.2s on a value like this and found
    // none of its keys.
    const fields = Object.fromEntries(Array.from({ length: 20_000 }, (_, index) => [`field_${index}`, `value ${index}`]))
    const update = 'UPDATE "jobs" SET "payload" = ? WHERE "id" = ?'
    const benign = JSON.stringify(JSON.stringify(fields))
    expect(queryLogBindings(update, [benign, 1], capture)).toEqual([benign, 1])
    expect(queryLogBindings(update, [JSON.stringify(JSON.stringify({ ...fields, reset_token: 'abc' })), 1], capture)).toEqual(['<redacted>', 1])
  })

  it('finds a JWT wherever a word starts, however long the run around it', () => {
    const jwt = [{ alg: 'HS256' }, { sub: 'fixture-user' }].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.')
    for (const value of [`${jwt}.`, `ref-${jwt}.sig`, `${'-eyJ'.repeat(50_000)}-${jwt}.sig`, `${'x.'.repeat(50_000)}${jwt}.sig`, `Bearer ${jwt}.sig and more`])
      expect(looksLikeCredential(value)).toBe(true)
    // It needs 8 characters after `eyJ`, 8 in the next segment, and a dot after them.
    for (const value of [jwt, 'eyJxxxxxxx.yyyyyyyy.', 'eyJxxxxxxxx.yyyyyyy.', 'eyJxxxxxxxx.yyyyyyyy'])
      expect(looksLikeCredential(value)).toBe(false)
  })

  // Wherever values are kept every bound value is judged, and a caller
  // chooses much of what is bound. Each shape is aimed at one credential
  // pattern or at the key scan, is 262,144 characters long, and is neither a
  // credential nor JSON with a sensitive key, so the whole of it is read.
  // Matched as one pattern, the JWT shape took 4.0 to 4.2s in
  // looksLikeCredential alone and 12 to 14s for the three judgements below
  // (three runs, M2 Pro), about four times as long for twice the length.
  // Every shape now takes 69ms at most for all three on that machine. The
  // bound leaves room for a slower one.
  it('judges a value in time linear in its length, whatever it holds', () => {
    const length = 2 ** 18
    const fill = (unit: string): string => unit.repeat(Math.ceil(length / unit.length)).slice(0, length)
    const shapes: Record<string, string> = {
      // `eyJ` at every word start of one run, which a pattern re-read from each.
      'jwt run': fill('-eyJ'),
      'jwt segments': fill('-eyJ-eyJ.'),
      'jwt dots': fill('.'),
      'crypt run': `$pbkdf2${'x'.repeat(length - 8)}!`,
      'crypt starts': fill(`$pbkdf2${'-'.repeat(200)}!`),
      'hex': fill(`${'a'.repeat(31)}g`),
      'stripe': fill(`-sk_live_${'x'.repeat(15)}`),
      'aws': fill(`-AKIA${'A'.repeat(15)}`),
      'opaque runs': fill(`${'x'.repeat(31)} `),
      'opaque run': 'x'.repeat(length),
      'key quotes': fill(`"${' '.repeat(200)}`),
      // Key ends whose escapes differ, so each walks back past quotes of other counts.
      'key escapes': fill(Array.from({ length: 12 }, (_, count) => `x${'\\'.repeat(count)}":`).join('')),
      'key lengths': fill(`"${'x'.repeat(120)}":`),
    }
    for (const [name, value] of Object.entries(shapes)) {
      const started = performance.now()
      expect(looksLikeCredential(value), name).toBe(false)
      expect(queryLogBindings('SELECT * FROM posts WHERE title = ?', [value], capture), name).toEqual([value])
      expect(queryLogBindings('UPDATE posts SET meta = ? WHERE id = ?', [{ note: value }, 1], capture), name).toEqual([{ note: value }, 1])
      expect(performance.now() - started, name).toBeLessThan(1000)
    }
  })

  it('keeps benign values so the log stays useful', () => {
    const benign = [
      'active',
      'ada@example.com',
      '%ada%',
      '2026-09-21 10:00:00',
      '0f8fad5b-d9cb-469f-a165-70867728950e',
      'how-to-build-a-full-stack-app-with-stacks-and-bun-in-2026',
      'A sentence with spaces, digits 123 and punctuation.',
    ]
    for (const value of benign)
      expect(queryLogBindings('SELECT * FROM posts WHERE title = ?', [value], capture)).toEqual([value])
    expect(queryLogBindings('SELECT * FROM people WHERE status = ? AND id IN (?, ?, ?) LIMIT 5', ['active', 1, 2, 3], capture))
      .toEqual(['active', 1, 2, 3])
    expect(queryLogBindings('SELECT * FROM x WHERE a = ? AND b = ? AND c = ? AND d = ?', [true, null, undefined, new Date(0)], capture))
      .toEqual([true, null, null, new Date(0)])
  })

  it('fails closed when a sensitive statement cannot be read', () => {
    // No column to go by, and the statement names a sensitive one.
    expect(queryLogBindings('SELECT id FROM users WHERE coalesce(?, name) = name AND password IS NOT NULL', ['Ada'], capture)).toEqual(['<redacted>'])
    // An unterminated literal: judged by its words alone.
    expect(queryLogBindings('SELECT * FROM users WHERE token = ? AND note = \'open', ['abc'], capture)).toEqual(['<redacted>'])
    expect(queryLogBindings('SELECT * FROM posts WHERE title = ? AND note = \'open', ['abc'], capture)).toEqual(['abc'])
  })

  it('splits names into words before deciding', () => {
    for (const name of ['remember_token', 'rememberToken', 'APIKey', 'apiKey', 'x-api-key', 'pin', 'two_factor_recovery_codes', 'oauth_access_tokens', 'webauthn_challenges', 'Authorization', 'credit_card', 'creditCard', 'encryption_key', 'APP_KEY'])
      expect(isSensitiveName(name)).toBe(true)
    for (const name of ['shipping', 'email', 'status', 'keyword', 'tokenizer', 'user_id', 'key', 'author', 'card', 'app_name'])
      expect(isSensitiveName(name)).toBe(false)
  })

  it('serializes every value shape without failing', () => {
    expect(serializeQueryLogBindings('SELECT ?', [10n, new Uint8Array([1, 2])], capture)).toBe('["10","<bytes>"]')
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(serializeQueryLogBindings('SELECT ?', [circular], capture)).toBe('["<object>"]')
    expect(serializeQueryLogBindings('SELECT ?', 'not-an-array', capture)).toBe('["not-an-array"]')
    expect(serializeQueryLogBindings('SELECT 1', [], capture)).toBe('[]')
  })

  it('resolves every placeholder of a long IN list and a multi-row insert', () => {
    const ids = Array.from({ length: 5000 }, (_, index) => `id-${index}`)
    const inList = `SELECT * FROM users WHERE "remember_token" IN (${ids.map(() => '?').join(', ')}) AND status = ?`
    expect(queryLogBindings(inList, [...ids, 'active'], capture)).toEqual([...ids.map(() => '<redacted>'), 'active'])

    const rows = Array.from({ length: 500 }, (_, index) => [`user${index}@example.com`, `hash-${index}`])
    const insert = `INSERT INTO "users"("email","password")VALUES${rows.map(() => '(?,?)').join(',')}`
    expect(queryLogBindings(insert, rows.flat(), capture)).toEqual(rows.flatMap(([email]) => [email, '<redacted>']))
  })

  it('redacts the columns an application lists, a table-qualified one only in its table', () => {
    const code = 'GIFT-2026-ABCD'
    const listed = { captureValues: true, sensitiveColumns: ['gift_cards.code'] }
    // Neither its name nor its shape gives it away.
    expect(queryLogBindings('SELECT * FROM gift_cards WHERE code = ?', [code], capture)).toEqual([code])

    const inGiftCards: Array<[string, unknown[], unknown[]]> = [
      ['SELECT * FROM gift_cards WHERE code = ?', [code], ['<redacted>']],
      ['INSERT INTO `gift_cards`(`id`,`code`)VALUES(?,?)', [1, code], [1, '<redacted>']],
      ['UPDATE "public"."gift_cards" SET "code" = $1 WHERE "id" = $2', [code, 1], ['<redacted>', 1]],
      ['SELECT * FROM gift_cards AS g WHERE lower(g.code) = lower(?)', [code], ['<redacted>']],
      ['SELECT * FROM coupons c JOIN gift_cards g ON g.coupon_id = c.id WHERE g.code = ? AND c.code = ?', [code, code], ['<redacted>', code]],
      // Which table a bare `code` belongs to is not known; gift_cards is named, so it counts.
      ['SELECT * FROM coupons JOIN gift_cards ON gift_cards.coupon_id = coupons.id WHERE code = ?', [code], ['<redacted>']],
      // Its column cannot be worked out, and the statement names a listed one.
      ['SELECT * FROM gift_cards WHERE coalesce(?, code) = code', [code], ['<redacted>']],
    ]
    for (const [sql, parameters, expected] of inGiftCards)
      expect(queryLogBindings(sql, parameters, listed)).toEqual(expected)

    // Only in gift_cards: the same column elsewhere is kept.
    expect(queryLogBindings('SELECT * FROM coupons WHERE code = ?', [code], listed)).toEqual([code])
    expect(queryLogBindings('INSERT INTO `coupons`(`id`,`code`)VALUES(?,?)', [1, code], listed)).toEqual([1, code])
    // A bare name is the column in every table.
    expect(queryLogBindings('SELECT * FROM coupons WHERE code = ?', [code], { captureValues: true, sensitiveColumns: ['code'] })).toEqual(['<redacted>'])
    // A listed column takes numbers too, which a sensitive table alone does not.
    expect(queryLogBindings('SELECT * FROM verifications WHERE code = ?', [123456], capture)).toEqual([123456])
    expect(queryLogBindings('SELECT * FROM verifications WHERE code = ?', [123456], { captureValues: true, sensitiveColumns: ['verifications.code'] })).toEqual(['<redacted>'])
    // The names recognised anyway are extended, never replaced.
    expect(queryLogBindings('UPDATE users SET password = ?, nickname = ? WHERE id = ?', ['hunter2', 'ada', 1], listed)).toEqual(['<redacted>', 'ada', 1])
  })

  it('reads a listed column as a column or a table.column', () => {
    expect(parseSensitiveColumn('code')).toEqual({ column: 'code' })
    expect(parseSensitiveColumn('gift_cards.code')).toEqual({ table: 'gift_cards', column: 'code' })
    expect(parseSensitiveColumn(' "Gift_Cards"."CODE" ')).toEqual({ table: 'gift_cards', column: 'code' })
    expect(parseSensitiveColumn('public.gift_cards.code')).toEqual({ table: 'gift_cards', column: 'code' })
    for (const unreadable of ['', ' ', 'gift_cards.', '.code', 'gift_cards.*', 'gift cards.code', 'a.b.c.d', 'code, pin', 42, null, undefined, {}])
      expect(parseSensitiveColumn(unreadable)).toBeUndefined()
  })

  it('keeps only the type of each value when values are not captured', () => {
    expect(queryLogBindings(
      'SELECT * FROM people WHERE email = ? AND id = ? AND active = ? AND deleted_at IS ? AND born < ? AND avatar = ? AND total = ? AND meta = ?',
      ['ada@example.com', 4, true, null, new Date(0), new Uint8Array([1]), 10n, { a: 1 }],
      { captureValues: false },
    )).toEqual(['<string>', '<number>', '<boolean>', null, '<date>', '<bytes>', '<bigint>', '<object>'])
  })

  it('reads captureBindings the way other Stacks switches are read', () => {
    for (const on of [true, 'true', 'TRUE', '1', 'yes', 'Yes', 'on', ' ON ', 1])
      expect(parseCaptureBindings(on)).toBe(true)
    for (const off of [false, 'false', 'False', '0', 'no', 'NO', 'off', ' Off ', 0])
      expect(parseCaptureBindings(off)).toBe(false)
    // Not set: the caller falls back to the environment default.
    for (const unset of [undefined, null, '', '  '])
      expect(parseCaptureBindings(unset)).toBeUndefined()
    // Set, but not a switch: the caller keeps only types.
    for (const unrecognised of ['maybe', 'enabled', 'y', 'n', '2', 't', 'true false', {}])
      expect(parseCaptureBindings(unrecognised)).toBeNull()
  })
})

describe('query log errors', () => {
  const types = { captureValues: false }
  /** `message` as query_logs.error keeps it, for a query that bound `parameters`. */
  const logged = (sql: string, parameters: unknown[], message: string, options = capture): string | undefined =>
    persistQueryLogValues(sql, parameters, message, options).error
  const TOKEN = 'Zq7xT2mN9pL4vR8sK1wY6bH3jF5cD0gA-u_EeIiOo2k'

  // The messages are shaped as MySQL 8.4 and PostgreSQL 16 print them.
  it('takes a redacted value out of the error text, as each driver prints it', () => {
    const insert = 'INSERT INTO `devices`(`id`,`token`)VALUES(?,?)'
    expect(logged(insert, [2, TOKEN], `MySQLError: Duplicate entry '${TOKEN}' for key 'devices.token'`))
      .toBe(`MySQLError: Duplicate entry '<redacted>' for key 'devices.token'`)
    // MySQL cuts a duplicate key at 64 bytes.
    const long = TOKEN.repeat(2)
    expect(logged(insert, [2, long], `MySQLError: Duplicate entry '${long.slice(0, 64)}' for key 'devices.token'`))
      .toBe(`MySQLError: Duplicate entry '<redacted>' for key 'devices.token'`)
    // A rejected value, with every byte beyond printable ASCII as \xHH.
    expect(logged('INSERT INTO `devices`(`id`,`build`)VALUES(?,?)', [4, `café-${SESSION_ID}`], `MySQLError: Incorrect integer value: 'caf\\xC3\\xA9-${SESSION_ID}' for column 'build' at row 1`))
      .toBe(`MySQLError: Incorrect integer value: '<redacted>' for column 'build' at row 1`)
    expect(logged('DELETE FROM `devices` WHERE `build` = ?', [TOKEN], `MySQLError: Truncated incorrect INTEGER value: '${TOKEN}'`))
      .toBe(`MySQLError: Truncated incorrect INTEGER value: '<redacted>'`)
    expect(logged('SELECT * FROM "devices" WHERE "id" = $1', [TOKEN], `PostgresError: invalid input syntax for type uuid: "${TOKEN}"`))
      .toBe('PostgresError: invalid input syntax for type uuid: "<redacted>"')
    expect(logged('SELECT * FROM "devices" WHERE "token" = ANY($1)', [['plain-item']], 'PostgresError: malformed array literal: "plain-item"'))
      .toBe('PostgresError: malformed array literal: "<redacted>"')
    // A key over two columns: only the redacted part goes.
    expect(logged('INSERT INTO `grants`(`scope`,`secret`)VALUES(?,?)', ['read-write', 'hunter2'], `MySQLError: Duplicate entry 'read-write-hunter2' for key 'grants.scope'`))
      .toBe(`MySQLError: Duplicate entry 'read-write-<redacted>' for key 'grants.scope'`)
    // A redacted number, and binary, which the bindings only ever keep as `<bytes>`.
    expect(logged('INSERT INTO `otps`(`user_id`,`otp`)VALUES(?,?)', [1, 123456], `MySQLError: Duplicate entry '123456' for key 'otps.otp'`))
      .toBe(`MySQLError: Duplicate entry '<redacted>' for key 'otps.otp'`)
    expect(logged('INSERT INTO `digests`(`digest`)VALUES(?)', [new Uint8Array([0x62, 0x69, 0x6E, 0x00, 0xFF])], `MySQLError: Duplicate entry 'bin\\x00\\xFF' for key 'digests.digest'`))
      .toBe(`MySQLError: Duplicate entry '<bytes>' for key 'digests.digest'`)
  })

  it('keeps an error whose values the bindings keep as it is', () => {
    const duplicate = `MySQLError: Duplicate entry 'ada ? lovelace' for key 'devices.handle'`
    expect(logged('INSERT INTO `devices`(`id`,`handle`)VALUES(?,?)', [3, 'ada \u{1F600} lovelace'], duplicate)).toBe(duplicate)
    const constraint = 'SQLiteError: UNIQUE constraint failed: devices.token'
    expect(logged('INSERT INTO "devices"("id","token")VALUES(?,?)', [2, TOKEN], constraint)).toBe(constraint)
    expect(logged('SELECT 1', [], 'PostgresError: syntax error at or near "SELEC"')).toBe('PostgresError: syntax error at or near "SELEC"')
  })

  it('keeps only the type of a printed value when only types are kept', () => {
    // MySQL prints a character beyond three UTF-8 bytes as `?`, and stops at a NUL.
    expect(logged('INSERT INTO `devices`(`id`,`handle`)VALUES(?,?)', [3, 'ada \u{1F600} lovelace'], `MySQLError: Duplicate entry 'ada ? lovelace' for key 'devices.handle'`, types))
      .toBe(`MySQLError: Duplicate entry '<string>' for key 'devices.handle'`)
    expect(logged('INSERT INTO `devices`(`handle`)VALUES(?)', ['ada lovelace\0x'], `MySQLError: Duplicate entry 'ada lovelace' for key 'devices.handle'`, types))
      .toBe(`MySQLError: Duplicate entry '<string>' for key 'devices.handle'`)
    expect(logged('UPDATE `people` SET `rank` = ? WHERE `id` = ?', [{ theme: 'dark' }, 1], `MySQLError: Incorrect integer value: '{"theme":"dark"}' for column 'rank' at row 1`, types))
      .toBe(`MySQLError: Incorrect integer value: '<object>' for column 'rank' at row 1`)
    // Numbers stay: every id and limit is a number, and "at row 1" would go
    // too. One that would be redacted if values were kept goes as its type.
    const phone = `MySQLError: Duplicate entry '5551234567' for key 'people.phone'`
    expect(logged('INSERT INTO `people`(`phone`)VALUES(?)', [5551234567], phone, types)).toBe(phone)
    expect(logged('INSERT INTO `otps`(`user_id`,`otp`)VALUES(?,?)', [1, 123456], `MySQLError: Duplicate entry '123456' for key 'otps.otp'`, types))
      .toBe(`MySQLError: Duplicate entry '<number>' for key 'otps.otp'`)
  })

  it('leaves the words and names of the message alone when only types are kept', () => {
    // Bound `key`, `email` and `users` are shorter than 8 characters and not
    // secret, so they stay, and with them the words the message spells alike.
    const insert = 'INSERT INTO `users`(`email`,`channel`,`label`,`scope`)VALUES(?,?,?,?)'
    expect(logged(insert, ['ada@example.com', 'email', 'key', 'users'], `MySQLError: Duplicate entry 'ada@example.com' for key 'users.email'`, types))
      .toBe(`MySQLError: Duplicate entry '<string>' for key 'users.email'`)
    expect(logged('UPDATE `people` SET `rank` = ? WHERE `initial` = ? AND `locale` = ?', ['active', 'a', 'e'], `MySQLError: Incorrect integer value: 'active' for column 'rank' at row 1`, types))
      .toBe(`MySQLError: Incorrect integer value: 'active' for column 'rank' at row 1`)
    // NUL ends what MySQL prints, so this copy is 3 characters long.
    expect(logged('INSERT INTO `devices`(`handle`)VALUES(?)', ['ada\0lovelace'], `MySQLError: Duplicate entry 'ada' for key 'devices.handle'`, types))
      .toBe(`MySQLError: Duplicate entry 'ada' for key 'devices.handle'`)
    // A secret goes whatever its length, judged by its column as if values
    // were kept, even where the message spells a name the same way.
    expect(logged('INSERT INTO `cards`(`pin`)VALUES(?)', ['4821'], `MySQLError: Duplicate entry '4821' for key 'cards.pin'`, types))
      .toBe(`MySQLError: Duplicate entry '<string>' for key 'cards.pin'`)
    expect(logged('UPDATE `accounts` SET `password` = ? WHERE `id` = ?', ['users', 1], `MySQLError: Duplicate entry 'x' for key 'users.email'`))
      .toBe(`MySQLError: Duplicate entry 'x' for key '<redacted>.email'`)
  })

  it('leaves a copy it cannot tell from the rest of the message', () => {
    // MySQL 8.4 prints 64 bytes of a key over two columns, here 3 characters
    // of the second value, and only what a prefix index (`c(10)`) indexes.
    const insert = 'INSERT INTO `t`(`id`,`b`,`c`)VALUES(?,?,?)'
    const pair = `MySQLError: Duplicate entry '${'B'.repeat(60)}-SEC' for key 't.two'`
    expect(logged(insert, [8, 'B'.repeat(60), 'SECRETVALUE-XYZ-123456'], pair, types)).toBe(`MySQLError: Duplicate entry '<string>-SEC' for key 't.two'`)
    const prefix = `MySQLError: Duplicate entry 'PREFIXSECR' for key 't.pre'`
    expect(logged('INSERT INTO `t`(`id`,`c`)VALUES(?,?)', [10, 'PREFIXSECRETVALUE0002'], prefix, types)).toBe(prefix)
    // A value the statement changes before the driver prints it.
    const lower = `MySQLError: Duplicate entry '${'a'.repeat(64)}' for key 't.one'`
    expect(logged('INSERT INTO `t`(`id`,`a`)VALUES(?,LOWER(?))', [12, 'A'.repeat(100)], lower, types)).toBe(lower)
  })

  it('keeps at most MAX_QUERY_LOG_ERROR_LENGTH characters of the error', () => {
    const head = 'PostgresError: invalid input syntax for type uuid: "'
    const exact = head + 'x'.repeat(MAX_QUERY_LOG_ERROR_LENGTH - head.length)
    expect(logged('SELECT 1', [], exact)).toBe(exact)
    expect(logged('SELECT 1', [], `${exact}yz`)).toBe(`${exact}<truncated: 2 more characters>`)
    // A copy running past the limit goes whole, and so does a short one that
    // the limit would cut: what follows the limit is read before the cut.
    const long = `${head}${'x'.repeat(MAX_QUERY_LOG_ERROR_LENGTH - head.length - 20)}"${TOKEN}" and more`
    expect(logged('SELECT * FROM "devices" WHERE "token" = $1', [TOKEN], long)).toBe(`${long.slice(0, MAX_QUERY_LOG_ERROR_LENGTH - 19)}<redacted><truncated: ${long.length - MAX_QUERY_LOG_ERROR_LENGTH - 16} more characters>`)
    const short = `${head}${'x'.repeat(MAX_QUERY_LOG_ERROR_LENGTH - head.length - 4)} 'hunter2' and more`
    expect(logged('UPDATE "users" SET "password" = $1', ['hunter2'], short)).toBe(`${short.slice(0, MAX_QUERY_LOG_ERROR_LENGTH - 2)}<redacted><truncated: ${short.length - (MAX_QUERY_LOG_ERROR_LENGTH - 2 + 7)} more characters>`)
  })

  it('takes the values of a listed column out of the error text', () => {
    const listed = { captureValues: true, sensitiveColumns: ['gift_cards.code', 'gift_cards.serial'] }
    expect(logged('INSERT INTO `gift_cards`(`id`,`code`)VALUES(?,?)', [2, 'GIFT-2026-ABCD'], `MySQLError: Duplicate entry 'GIFT-2026-ABCD' for key 'gift_cards.code'`, listed))
      .toBe(`MySQLError: Duplicate entry '<redacted>' for key 'gift_cards.code'`)
    const coupon = `MySQLError: Duplicate entry 'GIFT-2026-ABCD' for key 'coupons.code'`
    expect(logged('INSERT INTO `coupons`(`id`,`code`)VALUES(?,?)', [2, 'GIFT-2026-ABCD'], coupon, listed)).toBe(coupon)
    // A listed number leaves the error in production too, and so does a
    // listed value shorter than the 8 characters an ordinary one needs.
    expect(logged('INSERT INTO `gift_cards`(`id`,`serial`)VALUES(?,?)', [2, 90210], `MySQLError: Duplicate entry '90210' for key 'gift_cards.serial'`, { ...listed, captureValues: false }))
      .toBe(`MySQLError: Duplicate entry '<number>' for key 'gift_cards.serial'`)
    expect(logged('INSERT INTO `gift_cards`(`id`,`code`)VALUES(?,?)', [2, 'AB12'], `MySQLError: Duplicate entry 'AB12' for key 'gift_cards.code'`, { ...listed, captureValues: false }))
      .toBe(`MySQLError: Duplicate entry '<string>' for key 'gift_cards.code'`)
    const unlisted = `MySQLError: Duplicate entry 'AB12' for key 'coupons.code'`
    expect(logged('INSERT INTO `coupons`(`id`,`code`)VALUES(?,?)', [2, 'AB12'], unlisted, { ...listed, captureValues: false })).toBe(unlisted)
  })

  it('reads a long withheld value only as far as the error text reaches', () => {
    // 20,000 fields of JSON, 537,781 characters, cut to 128 in the message.
    const payload = JSON.stringify(Object.fromEntries(Array.from({ length: 20_000 }, (_, index) => [`field_${index}`, `value ${index}`])))
    expect(logged('UPDATE `jobs` SET `payload` = ? WHERE `id` = ?', [payload, 1], `MySQLError: Incorrect integer value: '${payload.slice(0, 128)}' for column 'payload' at row 1`, types))
      .toBe(`MySQLError: Incorrect integer value: '<string>' for column 'payload' at row 1`)
    // Every one of 5,000 withheld values is looked for.
    const ids = Array.from({ length: 5000 }, (_, index) => `sess-${index}`)
    expect(logged(`SELECT * FROM sessions WHERE id IN (${ids.map(() => '?').join(', ')})`, ids, `PostgresError: invalid input syntax for type uuid: "${ids.at(-1)}"`))
      .toBe('PostgresError: invalid input syntax for type uuid: "<redacted>"')
    // MySQL escapes each byte of this value into 4 characters and prints 128
    // of them.
    expect(logged('UPDATE `t` SET `a` = ? WHERE `id` = 1', ['ࠀ'.repeat(5000)], `MySQLError: Incorrect integer value: '${'\\xE0\\xA0\\x80'.repeat(10)}\\xE0\\xA0' for column 'a' at row 1`, types))
      .toBe(`MySQLError: Incorrect integer value: '<string>' for column 'a' at row 1`)
  })

  it('judges in production only the values whose secrecy decides what the error keeps', () => {
    // A copy of 8 characters or more goes whether its value is secret or
    // not, so this one is written out as JSON once, to be looked for, and
    // not again to be judged.
    let written = 0
    const payload = { toJSON: () => { written++; return { note: 'goes either way' } } }
    expect(logged('UPDATE `jobs` SET `payload` = ? WHERE `id` = ?', [payload, 1], `MySQLError: Incorrect integer value: '{"note":"goes either way"}' for column 'payload' at row 1`, types))
      .toBe(`MySQLError: Incorrect integer value: '<object>' for column 'payload' at row 1`)
    expect(written).toBe(1)
    // A number is judged, but a value whose keys and values come to more
    // than 65,536 characters of JSON is taken to be secret unread, so its
    // numbers go too.
    const range = 'PostgresError: value "5551234567" is out of range for type integer'
    expect(logged('SELECT * FROM "t" WHERE "id" = ANY($1)', [[5_551_234_567, 2]], range, types)).toBe(range)
    const ids = Array.from({ length: 20_000 }, (_, index) => 5_551_234_567 + index)
    expect(logged('SELECT * FROM "t" WHERE "id" = ANY($1)', [ids], range, types)).toBe('PostgresError: value "<object>" is out of range for type integer')
  })

  it('looks for the items of arrays nested up to 32 deep, and keeps none of the error past that', () => {
    const nested = (depth: number, leaf: unknown): unknown => {
      let value = leaf
      for (let level = 0; level < depth; level++)
        value = [value]
      return value
    }
    const message = (printed: string): string => `MySQLError: Incorrect integer value: '${printed}' for column 'a' at row 1`
    const update = 'UPDATE `t` SET `a` = ? WHERE `id` = 1'
    expect(logged(update, [nested(32, 'leaf-value-0123')], message('leaf-value-0123'), types)).toBe(message('<object>'))
    expect(logged(update, [nested(33, 'leaf-value-0123')], message('leaf-value-0123'), types)).toBe('<object>')
    expect(logged('UPDATE `t` SET `token` = ? WHERE `id` = 1', [nested(33, 'x')], message('x'))).toBe('<redacted>')
    // So is an array holding itself, which JSON.stringify refuses.
    const cyclic: unknown[] = ['leaf-value-0123']
    cyclic.push(cyclic)
    expect(logged(update, [cyclic], message('leaf-value-0123'), types)).toBe('<object>')
  })

  // MySQL printed a nested array as its outer JSON text alone
  // ('[["alpha-one"],["bravo-two"]]') and PostgreSQL printed no inner array,
  // so an inner array's text is not looked for on its own. It was: a chain of
  // 31 arrays around one string gave 31 copies of it, three each when the
  // string was not ASCII, and 240 such chains in a 976 KiB body took 115 to
  // 400ms to leave only the marker, past MAX_PRINTED_CHARACTERS. They now
  // take 3 to 11ms (M2 Pro, shared with other work).
  it('looks for an array\'s own JSON text, not for each array inside it', () => {
    const chain = (leaf: string): unknown => {
      let value: unknown = leaf
      for (let level = 0; level < 30; level++)
        value = [value]
      return value
    }
    const leaf = `é0123456789abcdef0123456789abcdef${'a'.repeat(4048)}`
    const echoed = 'z'.repeat(5000)
    const parameters = JSON.parse(JSON.stringify([echoed, Array.from({ length: 240 }, () => chain(leaf)), 1]))
    const started = performance.now()
    const stored = logged('SELECT * FROM "t" WHERE "id" IN ($1, $2, $3)', parameters, `PostgresError: invalid input syntax for type integer: "${echoed}"`, types)!
    expect(performance.now() - started).toBeLessThan(1000)
    expect(stored.startsWith('PostgresError: invalid input syntax for type integer: "<string>')).toBe(true)
  })

  it('counts every value of a query against one budget', () => {
    // 40,000 items each: under MAX_PRINTED_ITEMS alone, past it together.
    const range = 'PostgresError: value "5551234567" is out of range for type integer'
    const list = (): number[] => Array.from({ length: 40_000 }, (_, index) => index)
    expect(logged('SELECT * FROM "t" WHERE "a" = ANY($1)', [list()], range, types)).toBe(range)
    expect(logged('SELECT * FROM "t" WHERE "a" = ANY($1) AND "b" = ANY($2) AND "c" = ANY($3)', [list(), list(), list()], range, types)).toBe('<object>')
  })

  // JSON.parse nests arrays 100,000 deep, and an array can hold another many
  // times over. Reading every array inside a value by recursion, writing
  // each one out as JSON, took 164 to 235ms for 4,000 levels, 0.9 to 2.1s
  // for 8,000, and 339s for 16,000, which then threw RangeError out of
  // persistQueryLogValues; the array holding one other 99,999 times took
  // 2.7 to 3.3s and 1.6 GB (M2 Pro, shared with other work). Past
  // MAX_PRINTED_DEPTH, MAX_PRINTED_ITEMS or MAX_PRINTED_CHARACTERS the error
  // now keeps only the value's marker, and each shape here takes 46ms at
  // most on that machine.
  it('stays within a time and memory bound on arrays built to be expensive', () => {
    const inner = ['y'.repeat(5000)]
    const shapes: Record<string, unknown> = {
      'wide': Array.from({ length: 1_000_000 }, (_, index) => index),
      'long items': Array.from({ length: 4100 }, () => 'x'.repeat(5000)),
      'one array many times': Array.from({ length: 99_999 }, () => inner),
      'deep': JSON.parse(`${'['.repeat(100_000)}"leaf"${']'.repeat(100_000)}`),
    }
    for (const [name, value] of Object.entries(shapes)) {
      const peak = process.resourceUsage().maxRSS
      const started = performance.now()
      expect(logged('SELECT * FROM "t" WHERE "id" = ANY($1)', [value], `PostgresError: malformed array literal: "${'x'.repeat(5000)}"`, types), name).toBe('<object>')
      expect(performance.now() - started, name).toBeLessThan(1000)
      expect(process.resourceUsage().maxRSS - peak, name).toBeLessThan(256 * 1024)
    }
  })

  // A caller can choose both the values and, through a value PostgreSQL
  // echoes, most of the error. A walk of the trie stops at the end of the
  // 4,112 characters read, so the scan is bounded by the text whatever the
  // values; the trie is built from every value's forms, so building it grows
  // with them. On an M2 Pro shared with other work (medians of 7 runs, two
  // or three rounds): the first two shapes take 5 to 7ms; one long value,
  // where every position starts a copy running to the end of the text, 10
  // to 12ms; 2,000 values sharing 4,200 dashes 27 to 35ms; a trie that
  // branches at every character, so that each character of each walk is a
  // Map lookup, 175 to 183ms; and 10,000 values sharing their first 4,100
  // characters, each read that far when it is added, 95 to 106ms. None grew
  // the process by more than 40 MB. The bound leaves room for a slower
  // machine. Those 10,000 values now go past MAX_PRINTED_CHARACTERS, which
  // counts every value of the query together, so 4,000 of them are read
  // here, and 10,000 leave only a marker.
  it('stays within a time and memory bound on adversarial errors', () => {
    const inList = (count: number): string => Array.from({ length: count }, () => '?').join(', ')
    const echo = (text: string): string => `PostgresError: invalid input syntax for type uuid: "${text}"`
    // 5,000 ids sharing their first 17 characters, in a 200 KB error.
    const ids = Array.from({ length: 5000 }, (_, index) => `sess-shared-head-${String(index).padStart(6, '0')}`)
    // Every position of the error starts a copy that runs as far as the text read.
    const dashes = '-'.repeat(200_000)
    const runs = Array.from({ length: 2000 }, (_, index) => `${'-'.repeat(4200)}${index}`)
    // Values ending at every length from 16 to 4,111, so the trie branches at every dash.
    const branches = Array.from({ length: 4096 }, (_, index) => `${'-'.repeat(16 + index)}x`)
    // Whole strings, as a request's values arrive, rather than concatenations.
    const sharedHead = (count: number): string[] => Array.from({ length: count }, (_, index) => Buffer.from(`${'-'.repeat(4100)}${String(index).padStart(12, '0')}`).toString('latin1'))
    const shared = sharedHead(4000)
    const shapes: Array<[sql: string, parameters: unknown[], message: string, value: string]> = [
      [`SELECT * FROM sessions WHERE id IN (${inList(5000)})`, ids, echo(ids.join(',').repeat(2).slice(0, 200_000)), 'sess-shared-head-'],
      [`SELECT * FROM sessions WHERE id IN (${inList(5000)})`, ids.map(() => ids[0]!), echo(`${ids[0]},`.repeat(8700)), 'sess-shared-head-'],
      ['UPDATE users SET password = ? WHERE id = 1', ['-'.repeat(5000)], echo(dashes), '-'.repeat(16)],
      [`SELECT * FROM sessions WHERE id IN (${inList(2000)})`, runs, echo(dashes), '-'.repeat(16)],
      [`SELECT * FROM sessions WHERE id IN (${inList(4096)})`, branches, echo(dashes), '-'.repeat(16)],
      [`SELECT * FROM sessions WHERE id IN (${inList(4000)})`, shared, echo(dashes), '-'.repeat(16)],
    ]
    for (const [sql, parameters, message, value] of shapes) {
      // maxRSS is the process's peak, in kilobytes.
      const peak = process.resourceUsage().maxRSS
      const started = performance.now()
      const stored = logged(sql, parameters, message)!
      expect(performance.now() - started).toBeLessThan(2000)
      expect(process.resourceUsage().maxRSS - peak).toBeLessThan(256 * 1024)
      expect(stored.startsWith('PostgresError: invalid input syntax for type uuid: "<redacted>')).toBe(true)
      expect(stored).not.toContain(value)
      expect(stored).toMatch(/<truncated: \d+ more characters>$/)
      expect(stored.length).toBeLessThanOrEqual(MAX_QUERY_LOG_ERROR_LENGTH + 40)
    }
    const many = sharedHead(10_000)
    const started = performance.now()
    expect(logged(`SELECT * FROM sessions WHERE id IN (${inList(10_000)})`, many, echo(dashes))).toBe('<redacted>')
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

interface Run {
  title: string
  appEnv: 'test' | 'production'
  /** DB_QUERY_LOGGING_CAPTURE_BINDINGS, left unset when absent. */
  setting?: string
  appConfig: 'current' | 'without-key' | 'opt-in'
  expect: 'values' | 'types'
  /** How the setting is read does not depend on the dialect, so these run on SQLite alone. */
  sqliteOnly?: boolean
  /** The logger reports this setting as unrecognised, once. */
  warns?: boolean
}

const runs: Run[] = [
  { title: 'query logs keep benign bindings and redact credentials', appEnv: 'test', appConfig: 'current', expect: 'values' },
  { title: 'production query logs keep only the type of each binding', appEnv: 'production', appConfig: 'current', expect: 'types' },
  { title: 'production keeps redacted values when the app config opts in', appEnv: 'production', appConfig: 'opt-in', expect: 'values' },
  { title: 'production keeps redacted values when DB_QUERY_LOGGING_CAPTURE_BINDINGS=true', appEnv: 'production', setting: 'true', appConfig: 'current', expect: 'values' },
  { title: 'an app config without captureBindings keeps redacted values outside production', appEnv: 'test', appConfig: 'without-key', expect: 'values' },
  { title: 'an app config without captureBindings keeps only types in production', appEnv: 'production', appConfig: 'without-key', expect: 'types' },
  { title: 'an app config without captureBindings reads DB_QUERY_LOGGING_CAPTURE_BINDINGS=off', appEnv: 'test', setting: 'off', appConfig: 'without-key', expect: 'types', sqliteOnly: true },
  { title: 'an app config without captureBindings reads DB_QUERY_LOGGING_CAPTURE_BINDINGS=1', appEnv: 'production', setting: '1', appConfig: 'without-key', expect: 'values', sqliteOnly: true },
  { title: 'DB_QUERY_LOGGING_CAPTURE_BINDINGS=0 keeps only types outside production', appEnv: 'test', setting: '0', appConfig: 'current', expect: 'types', sqliteOnly: true },
  { title: 'DB_QUERY_LOGGING_CAPTURE_BINDINGS=" Yes " keeps redacted values in production', appEnv: 'production', setting: ' Yes ', appConfig: 'current', expect: 'values', sqliteOnly: true },
  { title: 'an unrecognised DB_QUERY_LOGGING_CAPTURE_BINDINGS keeps only types and warns once', appEnv: 'test', setting: 'maybe', appConfig: 'current', expect: 'types', sqliteOnly: true, warns: true },
  { title: 'an unrecognised DB_QUERY_LOGGING_CAPTURE_BINDINGS fails closed without the config key too', appEnv: 'test', setting: 'enabled', appConfig: 'without-key', expect: 'types', sqliteOnly: true, warns: true },
]

const CAPTURE_BINDINGS_WARNING = '[database] queryLogging.captureBindings (DB_QUERY_LOGGING_CAPTURE_BINDINGS) is'

type Dialect = 'sqlite' | 'postgres' | 'mysql'

function serverUrl(dialect: Dialect): string | undefined {
  return dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : dialect === 'mysql' ? process.env.STACKS_TEST_MYSQL_URL : undefined
}

/**
 * Runs `fixture` in its own process against a disposable `dialect` database
 * with `env` on top, requires it to exit cleanly, and returns its output.
 */
async function runFixture(dialect: Dialect, fixture: string, env: Record<string, string>): Promise<{ stdout: string, stderr: string }> {
  const connection = serverUrl(dialect)
  const url = dialect === 'sqlite' ? undefined : new URL(connection!)
  if (url && (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.port || ['5432', '3306'].includes(url.port)))
    throw new Error('Query log binding tests require a local disposable database server on a non-default port')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-query-log-bindings-'))
  const name = `stacks_query_log_bindings_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = url ? new SQL(url.href) : undefined
  const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
  let created = false
  try {
    const config = join(directory, 'bunfig.toml')
    // Passing --config at this file replaces the repo bunfig, so the child
    // inherits none of its preloads. The key is left out rather than set to
    // an empty array: `preload = []` is rejected by Bun before 1.4.
    await writeFile(config, '# no preload\n')
    // Config is resolved from the application's cwd, not the framework
    // package. Give each child a tiny isolated app which loads the real
    // database config under test, without inheriting other app config/env.
    await mkdir(join(directory, 'config'))
    const databaseConfig = new URL('../../../../../config/database.ts', import.meta.url).href
    await writeFile(join(directory, 'config/database.ts'), `export { default } from ${JSON.stringify(databaseConfig)}\n`)
    if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
    // The run decides the setting, so an override in the calling shell
    // must not. With no preload and no env file, nothing puts it back.
    const inherited = { ...process.env }
    delete inherited.DB_QUERY_LOGGING_CAPTURE_BINDINGS
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/${fixture}`], {
      cwd: directory,
      env: {
        ...inherited, DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'true',
        DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'query-log-bindings.sqlite') : ':memory:',
        STACKS_QUERY_LOG_BINDINGS_CONFIG: config,
        ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        ...env,
      }, stdout: 'pipe', stderr: 'pipe',
    })
    let timedOut = false
    const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(timedOut, `${fixture} must finish without a watchdog kill`).toBe(false)
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      return { stdout, stderr }
    }
    finally { clearTimeout(watchdog); child.kill(); await child.exited }
  }
  finally {
    try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
    finally {
      try { await admin?.close() }
      finally { await rm(directory, { recursive: true, force: true }) }
    }
  }
}

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  for (const run of runs.filter(run => dialect === 'sqlite' || !run.sqliteOnly)) {
    test.skipIf(dialect !== 'sqlite' && !serverUrl(dialect))(`${dialect} ${run.title}`, async () => {
      const { stdout, stderr } = await runFixture(dialect, 'query-log-bindings.ts', {
        APP_ENV: run.appEnv,
        ...(run.setting === undefined ? {} : { DB_QUERY_LOGGING_CAPTURE_BINDINGS: run.setting }),
        STACKS_QUERY_LOG_BINDINGS_APP_CONFIG: run.appConfig,
        STACKS_QUERY_LOG_BINDINGS_EXPECT: run.expect,
      })
      expect(stdout).toContain('query log bindings OK')
      // Every one of the fixture's eight queries resolves the setting.
      expect(stderr.split('\n').filter(line => line.includes(CAPTURE_BINDINGS_WARNING)).length, stderr).toBe(run.warns ? 1 : 0)
    }, 30_000)
  }

  // A failed query's error text copies bound values: MySQL's "Duplicate
  // entry '...'" and "Incorrect integer value: '...'", PostgreSQL's "invalid
  // input syntax for type integer: \"...\"". fixtures/query-log-errors.ts
  // makes each of those fail and reads back what was stored.
  for (const run of [
    { title: 'failed query logs keep redacted values out of the error', appEnv: 'test', expect: 'values' },
    { title: 'production failed query logs keep only types of the values in the error', appEnv: 'production', expect: 'types' },
    // `gift_cards.*` is not a column: it is reported once, over every query,
    // and the entry beside it still counts.
    { title: 'query logs redact a column the application lists, in bindings and errors', appEnv: 'test', expect: 'values', sensitiveColumns: '["gift_cards.code","gift_cards.*"]' },
  ]) {
    test.skipIf(dialect !== 'sqlite' && !serverUrl(dialect))(`${dialect} ${run.title}`, async () => {
      const { stdout, stderr } = await runFixture(dialect, 'query-log-errors.ts', {
        APP_ENV: run.appEnv,
        STACKS_QUERY_LOG_BINDINGS_EXPECT: run.expect,
        STACKS_QUERY_LOG_BINDINGS_SENSITIVE_COLUMNS: run.sensitiveColumns ?? '',
      })
      expect(stdout).toContain('query log errors OK')
      const warnings = stderr.split('\n').filter(line => line.includes('[database] queryLogging.sensitiveColumns has'))
      expect(warnings, stderr).toEqual(run.sensitiveColumns ? [expect.stringContaining('"gift_cards.*", which is not a column or table.column')] : [])
    }, 30_000)
  }
}
