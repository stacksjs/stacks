/**
 * query_logs.bindings must not hold credentials. See src/query-log-bindings.ts
 * for the policy and fixtures/query-log-bindings.ts for what the runners do.
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

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'
import { describe, expect, it, test } from 'bun:test'
import { isSensitiveName, looksLikeCredential, parseCaptureBindings, queryLogBindings, serializeQueryLogBindings } from '../src/query-log-bindings'

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

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  for (const run of runs.filter(run => dialect === 'sqlite' || !run.sqliteOnly)) {
    test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} ${run.title}`, async () => {
      const url = dialect === 'sqlite' ? undefined : new URL(connection!)
      if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
        throw new Error('Query log binding tests require a local disposable database server')
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
        if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
        // The run decides the setting, so an override in the calling shell
        // must not. With no preload and no env file, nothing puts it back.
        const inherited = { ...process.env }
        delete inherited.DB_QUERY_LOGGING_CAPTURE_BINDINGS
        const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/query-log-bindings.ts`], {
          env: {
            ...inherited, APP_ENV: run.appEnv, DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'true',
            ...(run.setting === undefined ? {} : { DB_QUERY_LOGGING_CAPTURE_BINDINGS: run.setting }),
            DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'query-log-bindings.sqlite') : ':memory:',
            STACKS_QUERY_LOG_BINDINGS_CONFIG: config,
            STACKS_QUERY_LOG_BINDINGS_APP_CONFIG: run.appConfig,
            STACKS_QUERY_LOG_BINDINGS_EXPECT: run.expect,
            ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
              DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
              DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
          }, stdout: 'pipe', stderr: 'pipe',
        })
        let timedOut = false
        const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
        try {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          expect(timedOut, 'query log bindings must finish without a watchdog kill').toBe(false)
          expect(code, `${stdout}\n${stderr}`).toBe(0)
          expect(stdout).toContain('query log bindings OK')
          // Every one of the fixture's eight queries resolves the setting.
          expect(stderr.split('\n').filter(line => line.includes(CAPTURE_BINDINGS_WARNING)).length, stderr).toBe(run.warns ? 1 : 0)
        }
        finally { clearTimeout(watchdog); child.kill() }
      }
      finally {
        try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
        finally {
          try { await admin?.close() }
          finally { await rm(directory, { recursive: true, force: true }) }
        }
      }
    }, 30_000)
  }
}
