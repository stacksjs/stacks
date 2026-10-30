import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assignedServicePort, syncDatabasePortToEnv } from '../src/pantry-service-ports'

const made: string[] = []

function fixture(env: string, assignments: unknown[]) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'ports-home-')))
  const app = realpathSync(mkdtempSync(join(tmpdir(), 'ports-app-')))
  made.push(home, app)
  mkdirSync(join(home, '.local', 'share', 'pantry'), { recursive: true })
  writeFileSync(join(home, '.local', 'share', 'pantry', 'ports.json'), JSON.stringify({ version: 1, assignments }))
  writeFileSync(join(app, '.env'), env)
  return { home, app }
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('pantry service ports', () => {
  it('finds the port assigned to this project and not another project\'s', () => {
    const { home, app } = fixture('', [])
    writeFileSync(join(home, '.local', 'share', 'pantry', 'ports.json'), JSON.stringify({ assignments: [
      { project: 'a', service: 'mysql', port: 3306, root: '/somewhere/else' },
      { project: 'b', service: 'mysql', port: 3406, root: app },
      { project: 'b', service: 'postgres', port: 5532, root: app },
    ] }))
    expect(assignedServicePort(app, 'mysql', home)).toBe(3406)
    expect(assignedServicePort(app, 'postgres', home)).toBe(5532)
    expect(assignedServicePort(app, 'redis', home)).toBeUndefined()
  })

  it('rewrites DB_PORT when Pantry assigned a different one', () => {
    const { home, app } = fixture('DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=3306\n', [])
    writeFileSync(join(home, '.local', 'share', 'pantry', 'ports.json'), JSON.stringify({ assignments: [{ service: 'mysql', port: 3406, root: app }] }))
    expect(syncDatabasePortToEnv(app, home)).toEqual({ service: 'mysql', port: 3406, changed: true })
    expect(readFileSync(join(app, '.env'), 'utf8')).toBe('DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=3406\n')
    expect(syncDatabasePortToEnv(app, home).changed).toBe(false)
  })

  it('appends DB_PORT when .env has none', () => {
    const { home, app } = fixture('DB_CONNECTION=postgres', [])
    writeFileSync(join(home, '.local', 'share', 'pantry', 'ports.json'), JSON.stringify({ assignments: [{ service: 'postgres', port: 5532, root: app }] }))
    syncDatabasePortToEnv(app, home)
    expect(readFileSync(join(app, '.env'), 'utf8')).toBe('DB_CONNECTION=postgres\nDB_PORT=5532\n')
  })

  it('leaves sqlite, remote hosts and unassigned projects alone', () => {
    const sqlite = fixture('DB_CONNECTION=sqlite\nDB_PORT=1\n', [])
    expect(syncDatabasePortToEnv(sqlite.app, sqlite.home).changed).toBe(false)
    const remote = fixture('DB_CONNECTION=mysql\nDB_HOST=db.example.com\nDB_PORT=3306\n', [])
    writeFileSync(join(remote.home, '.local', 'share', 'pantry', 'ports.json'), JSON.stringify({ assignments: [{ service: 'mysql', port: 3406, root: remote.app }] }))
    expect(syncDatabasePortToEnv(remote.app, remote.home).changed).toBe(false)
    const none = fixture('DB_CONNECTION=mysql\nDB_PORT=3306\n', [])
    expect(syncDatabasePortToEnv(none.app, none.home)).toEqual({ service: 'mysql', port: undefined, changed: false })
  })
})
