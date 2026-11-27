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
 *    proxy (which would ask for sudo), no native window. It runs in a scratch
 *    project (`scratchProject`), so a page that writes the project's own
 *    files, as Mail settings writes `.env` and General settings writes
 *    `config/*.ts`, writes the scratch copy and never the checkout.
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
import { cpSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const checkout = resolve(import.meta.dir, '../../..')

export const dashboardE2EAvailable: boolean = Boolean(disposablePostgresUrl()) && Boolean(findChrome())

export interface DashboardE2E {
  /** Where the dashboard answers, e.g. `http://localhost:61234`. */
  origin: string
  database: CreatedDisposableDatabase
  browser: LaunchedChrome
  /**
   * The project directory the dashboard runs in: the checkout's code, with
   * its own `config/`, `.env` and runtime state (see `scratchProject`).
   */
  project: string
  /** Run SQL against the dashboard's database, to arrange or check rows. */
  sql: <T = Record<string, unknown>>(query: string, ...values: unknown[]) => Promise<T[]>
  /** Stop the browser and the server, and drop the database. Safe to call twice. */
  close: () => Promise<void>
}

/** Start the dashboard on a fresh, migrated and seeded database. */
export async function startDashboardE2E({ mailServerMode = 'server' }: { mailServerMode?: 'server' | 'serverless' } = {}): Promise<DashboardE2E> {
  const database = await createDisposableDatabase('postgres', { prefix: 'stacks_e2e' })
  const checkoutBefore = trackedChanges()
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
    const written = [...trackedChanges()].filter(line => !checkoutBefore.has(line))
    if (written.length)
      throw new Error(`The dashboard under test changed the checkout:\n${written.join('\n')}`)
  }

  try {
    const env = { ...dashboardEnv(database), MAIL_SERVER_MODE: mailServerMode }
    await buddy(['migrate', '--generate', '--force'], env, database.directory, 'migrate')
    await buddy(['seed'], env, database.directory, 'seed')

    const port = await freePort()
    const out = join(database.directory, 'dashboard.out')
    const err = join(database.directory, 'dashboard.err')
    const project = scratchProject(join(database.directory, 'project'))
    server = Bun.spawn([process.execPath, join(checkout, 'storage/framework/core/actions/src/dev/dashboard.ts')], {
      cwd: project,
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
      project,
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
    // No AWS account: the checkout's `.env` and `~/.aws` hold real
    // credentials, and a test that reads a real bucket on one machine and
    // none on another passes on the first and fails on the second. Empty
    // keys and credential files that do not exist leave the SDK nothing.
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    AWS_SESSION_TOKEN: '',
    AWS_PROFILE: '',
    AWS_SHARED_CREDENTIALS_FILE: join(scratch, 'no-aws-credentials'),
    AWS_CONFIG_FILE: join(scratch, 'no-aws-config'),
    // Per-person dashboard preferences (the sidebar order) live under the
    // config home, outside any project. A test must not write a person's.
    XDG_CONFIG_HOME: join(scratch, 'config-home'),
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

/**
 * A Stacks project for the dashboard to run in that is not the checkout.
 *
 * Every path the framework writes to is the project root's: `.env`,
 * `config/`, `storage/framework/runtime`. There are dozens of them (45
 * places build a `config/` path and 54 a `.env` one), so pointing a test at
 * scratch files one setting at a time would cover two and miss the rest.
 * Running in a different project covers all of them.
 *
 * The project links to the checkout for everything it only reads: the code,
 * the framework, `node_modules`. It owns:
 *
 * - `config/`, a copy, which General settings edits;
 * - `.env`, empty, which Mail settings and the Environment page write. The
 *   checkout's `.env` files hold real credentials, so none is copied; what
 *   the server needs is given outright in `dashboardEnv`;
 * - `storage/framework/runtime`, where the Environment page keeps the copy of
 *   `.env` it replaced, and which would otherwise overwrite the checkout's;
 * - `storage/framework/defaults`, a copy. It has to be a real directory: a
 *   linked one reads as a package-based app (`usesVendoredDefaults`), which
 *   takes its defaults from the installed `@stacksjs/defaults`, an old build
 *   here, and not from the checkout's source;
 * - `storage/framework/auto-imports` and `types`, copies. A server that finds
 *   them stale regenerates them, and through a link it would rewrite the
 *   checkout's tracked files.
 *
 * `close()` still checks that no tracked file in the checkout changed, so a
 * write this list misses fails the suite instead of passing unseen.
 *
 * It lives in a temp folder, which the project list treats as transient
 * (`isTransientCheckout`), so it is never listed as one of a person's
 * projects.
 */
function scratchProject(root: string): string {
  const owned = new Set(['.git', 'config', 'storage'])
  mkdirSync(root, { recursive: true })
  for (const entry of readdirSync(checkout)) {
    if (!owned.has(entry) && !entry.startsWith('.env'))
      symlinkSync(join(checkout, entry), join(root, entry))
  }
  cpSync(join(checkout, 'config'), join(root, 'config'), { recursive: true })
  writeFileSync(join(root, '.env'), '')

  mkdirSync(join(root, 'storage/framework/runtime'), { recursive: true })
  for (const entry of readdirSync(join(checkout, 'storage'))) {
    if (entry !== 'framework')
      symlinkSync(join(checkout, 'storage', entry), join(root, 'storage', entry))
  }
  const copied = new Set(['auto-imports', 'defaults', 'types'])
  for (const entry of readdirSync(join(checkout, 'storage/framework'))) {
    if (entry === 'runtime')
      continue
    if (copied.has(entry))
      cpSync(join(checkout, 'storage/framework', entry), join(root, 'storage/framework', entry), { recursive: true })
    else
      symlinkSync(join(checkout, 'storage/framework', entry), join(root, 'storage/framework', entry))
  }
  return root
}

/**
 * The checkout's changed tracked files, as `git status` lists them. Compared
 * before and after a run, it is what proves the scratch project kept the
 * dashboard's writes to itself.
 */
function trackedChanges(): Set<string> {
  const status = Bun.spawnSync(['git', 'status', '--porcelain', '--untracked-files=no'], { cwd: checkout })
  if (status.exitCode !== 0)
    throw new Error(`git status failed in ${checkout}: ${status.stderr.toString()}`)
  return new Set(status.stdout.toString().split('\n').filter(Boolean))
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
