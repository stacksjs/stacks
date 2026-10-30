/**
 * Keep `.env` pointed at the port Pantry gave this project's database.
 *
 * Pantry assigns service ports per project (`~/.local/share/pantry/ports.json`)
 * so two checkouts that both run MySQL do not fight over 3306: the first gets
 * 3306, the next 3406, and so on. The assignment is stable, but nothing told the
 * app. `.env` kept saying `DB_PORT=3306`, so the second project's `buddy migrate`
 * quietly talked to the FIRST project's server, which answered with someone
 * else's databases and a "missing-database" error that named the wrong cause.
 *
 * `buddy setup` has just started the service, so it is the one place that knows
 * the assignment is current. It copies the port into `.env` and says so.
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The Pantry service a `DB_CONNECTION` is served by. SQLite is a file and has none. */
const DATABASE_SERVICES: Record<string, string> = {
  mysql: 'mysql',
  postgres: 'postgres',
}

interface PortAssignment {
  service: string
  port: number
  root?: string
}

export interface PortSyncResult {
  /** The service whose port was looked up, when the connection has one. */
  service?: string
  /** The port Pantry assigned this project. */
  port?: number
  /** Whether `.env` was rewritten. */
  changed: boolean
}

function canonical(path: string): string {
  try {
    return realpathSync(path)
  }
  catch {
    return path
  }
}

/** Where Pantry records its assignments; `home` is injectable for tests. */
export function pantryPortsFile(home: string = homedir()): string {
  return join(home, '.local', 'share', 'pantry', 'ports.json')
}

/**
 * The port Pantry assigned to `service` for the project rooted at `root`, or
 * undefined when nothing was assigned (the service never started here).
 */
export function assignedServicePort(root: string, service: string, home: string = homedir()): number | undefined {
  const file = pantryPortsFile(home)

  if (!existsSync(file))
    return undefined

  let assignments: PortAssignment[]

  try {
    assignments = (JSON.parse(readFileSync(file, 'utf8')) as { assignments?: PortAssignment[] }).assignments ?? []
  }
  catch {
    return undefined
  }

  const wanted = canonical(root)
  const match = assignments.find(entry => entry.service === service && typeof entry.port === 'number' && !!entry.root && canonical(entry.root) === wanted)

  return match?.port
}

function envValue(contents: string, key: string): string | undefined {
  const match = contents.match(new RegExp(`^${key}=(.*)$`, 'm'))

  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Write the assigned port into `.env` when it differs from what is there.
 * Leaves the file alone for SQLite, for a remote `DB_HOST`, and when Pantry has
 * assigned nothing: in each case `DB_PORT` is not Pantry's to decide.
 */
export function syncDatabasePortToEnv(cwd: string, home: string = homedir()): PortSyncResult {
  const envPath = join(cwd, '.env')

  if (!existsSync(envPath))
    return { changed: false }

  const contents = readFileSync(envPath, 'utf8')
  const service = DATABASE_SERVICES[envValue(contents, 'DB_CONNECTION') ?? '']

  if (!service)
    return { changed: false }

  const host = envValue(contents, 'DB_HOST') || '127.0.0.1'

  if (!['127.0.0.1', 'localhost', '::1'].includes(host))
    return { service, changed: false }

  const port = assignedServicePort(cwd, service, home)

  if (port === undefined || envValue(contents, 'DB_PORT') === String(port))
    return { service, port, changed: false }

  const next = /^DB_PORT=.*$/m.test(contents)
    ? contents.replace(/^DB_PORT=.*$/m, `DB_PORT=${port}`)
    : `${contents.replace(/\n*$/, '\n')}DB_PORT=${port}\n`

  writeFileSync(envPath, next)

  return { service, port, changed: true }
}
