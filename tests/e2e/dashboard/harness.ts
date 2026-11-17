/**
 * The dashboard, end to end: the real server on a real database, driven by a
 * real browser (stacksjs/stacks#3319).
 *
 * The dashboard's unit tests read component source and call actions
 * directly. The browser check of #3315 found three faults none of them could
 * see: row buttons stx never rendered (stacksjs/stx#2197), a required parent
 * link that refused every new row, and a Postgres error that blamed the wrong
 * field. This harness is how a test sees what a person sees.
 *
 * `startDashboardE2E()`:
 *
 * 1. Creates a disposable Postgres database on the server named by
 *    `STACKS_TEST_POSTGRES_URL` (a local one only; see
 *    `createDisposableDatabase`). Postgres, because that is what this
 *    checkout runs on.
 * 2. Generates the schema from the models and migrates it, with the corpus
 *    and the snapshot in the database's own temp folder
 *    (`DB_MIGRATIONS_PATH`, `DB_SNAPSHOT_PATH`), so nothing in the checkout
 *    is written. Then seeds it.
 * 3. Starts the dashboard server as a worker on a free port: no reverse
 *    proxy (which would ask for sudo), no native window.
 * 4. Opens headless Chrome on it.
 *
 * `close()` stops all of it and drops the database. Without a Postgres URL or
 * a Chrome, `dashboardE2EAvailable` is false and the suites skip, so a plain
 * `bun test` on a laptop does not try to start a dashboard.
 */
import type { LaunchedChrome } from '@stacksjs/testing/browser'
import type { CreatedDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { click, findChrome, launch, navigate, waitFor } from '@stacksjs/testing/browser'
import { createDisposableDatabase, disposablePostgresUrl } from '@stacksjs/testing/disposable-database'
import { SQL } from 'bun'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const checkout = resolve(import.meta.dir, '../../..')

export const dashboardE2EAvailable: boolean = Boolean(disposablePostgresUrl()) && Boolean(findChrome())

export interface DashboardE2E {
  /** Where the dashboard answers, e.g. `http://localhost:61234`. */
  origin: string
  database: CreatedDisposableDatabase
  browser: LaunchedChrome
  /** Run SQL against the dashboard's database, to arrange or check rows. */
  sql: <T = Record<string, unknown>>(query: string, ...values: unknown[]) => Promise<T[]>
  /** Stop the browser and the server, and drop the database. Safe to call twice. */
  close: () => Promise<void>
}

/** Start the dashboard on a fresh, migrated and seeded database. */
export async function startDashboardE2E(): Promise<DashboardE2E> {
  const database = await createDisposableDatabase('postgres', { prefix: 'stacks_e2e' })
  let server: ReturnType<typeof Bun.spawn> | undefined
  let browser: LaunchedChrome | undefined
  let client: SQL | undefined
  let closed = false
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    await browser?.close().catch(() => {})
    server?.kill()
    await server?.exited
    await client?.close().catch(() => {})
    await database.drop()
  }

  try {
    const env = dashboardEnv(database)
    await buddy(['migrate', '--generate', '--force'], env, database.directory, 'migrate')
    await buddy(['seed'], env, database.directory, 'seed')

    const port = await freePort()
    const out = join(database.directory, 'dashboard.out')
    const err = join(database.directory, 'dashboard.err')
    server = Bun.spawn([process.execPath, join(checkout, 'storage/framework/core/actions/src/dev/dashboard.ts')], {
      cwd: checkout,
      env: { ...env, PORT_ADMIN: String(port), STACKS_DASHBOARD_WORKER: '1', STACKS_DEV_SERVER: '1', STACKS_DEV_AUTO_MIGRATE: '0' },
      stdin: 'ignore',
      stdout: Bun.file(out),
      stderr: Bun.file(err),
    })
    // The worker listens on `localhost`, which may be IPv6 only.
    const origin = `http://localhost:${port}`
    await waitUntilServing(server, origin, () => `${tail(out)}\n${tail(err)}`)

    browser = await launch({ viewport: { width: 1440, height: 1000 } })
    client = new SQL(database.sqlOptions!)
    const sql = client
    return {
      origin,
      database,
      browser,
      sql: async <T>(query: string, ...values: unknown[]) => await sql.unsafe(query, values) as T[],
      close,
    }
  }
  catch (error) {
    await close()
    throw error
  }
}

/**
 * The environment the CLI and the server run under: the disposable database,
 * a loopback app URL, and every value given outright. A subprocess here reads
 * the checkout's `.env` too, so anything left unset would come from it.
 */
function dashboardEnv(database: CreatedDisposableDatabase): Record<string, string> {
  const scratch = join(database.directory, 'schema')
  mkdirSync(join(scratch, 'migrations'), { recursive: true })
  mkdirSync(join(scratch, 'snapshot'), { recursive: true })
  return {
    ...process.env as Record<string, string>,
    ...database.env,
    APP_ENV: 'test',
    // A loopback URL, and localhost-only serving: no `*.localhost` domain to
    // put a reverse proxy in front of, which would ask for sudo.
    APP_URL: 'http://127.0.0.1:4320',
    STACKS_DEV_LOCALHOST: '1',
    STACKS_NO_NATIVE: '1',
    DB_MIGRATIONS_PATH: join(scratch, 'migrations'),
    DB_SNAPSHOT_PATH: join(scratch, 'snapshot'),
  }
}

/**
 * The password every seeded user has: the User model's factory sets it
 * (`storage/framework/defaults/app/Models/User.ts`). A test value, never a
 * real one.
 */
const SEEDED_PASSWORD = 'password1234'

/**
 * Sign the browser in through the dashboard's own login page, as the first
 * seeded user, the way a person does.
 *
 * Some of the dashboard is for a signed-in person in every environment, local
 * included: Remote runs commands on a server, and Billing is the account's.
 * Signed out, their pages answer 401, which is correct and is not what a test
 * of an admin's dashboard should be looking at.
 */
export async function signIn(e2e: DashboardE2E): Promise<string> {
  const [user] = await e2e.sql<{ email: string }>('SELECT email FROM users ORDER BY id LIMIT 1')
  if (!user) throw new Error('The seeded database has no user to sign in as.')
  const { cdp } = e2e.browser
  await navigate(cdp, `${e2e.origin}/login`)
  await click(cdp, 'input[type="email"]')
  await cdp.send('Input.insertText', { text: user.email })
  await click(cdp, 'input[type="password"]')
  await cdp.send('Input.insertText', { text: SEEDED_PASSWORD })
  await click(cdp, 'button[type="submit"]')
  await waitFor(async () => (await cdp.evaluate<string>('location.pathname')) !== '/login' || null, 20_000, { label: `sign in as ${user.email}` })
  return user.email
}

async function buddy(args: string[], env: Record<string, string>, directory: string, label: string): Promise<void> {
  const log = join(directory, `${label}.log`)
  const child = Bun.spawn([join(checkout, 'buddy'), ...args], { cwd: checkout, env, stdin: 'ignore', stdout: Bun.file(log), stderr: 'pipe' })
  const [code, errors] = await Promise.all([child.exited, new Response(child.stderr).text()])
  if (code !== 0)
    throw new Error(`buddy ${args.join(' ')} exited ${code}:\n${tail(log)}\n${errors.slice(-2000)}`)
}

async function freePort(): Promise<number> {
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = reservation.port!
  await reservation.stop(true)
  return port
}

/** Ready once the models API answers: the routes, the database and the models are all up. */
async function waitUntilServing(server: ReturnType<typeof Bun.spawn>, origin: string, output: () => string): Promise<void> {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`The dashboard exited (${server.exitCode}) before serving:\n${output()}`)
    const ready = await fetch(`${origin}/api/dashboard/models`).then(response => response.status === 200, () => false)
    if (ready) return
    await Bun.sleep(200)
  }
  throw new Error(`The dashboard did not serve ${origin} within 90s:\n${output()}`)
}

function tail(file: string, lines = 40): string {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(line => !line.startsWith('[env]')).slice(-lines).join('\n')
  }
  catch {
    return ''
  }
}
