/**
 * A built web view app runs on the config compiled into it, and says which
 * config it booted with (stacksjs/stacks#3368).
 *
 * Config loads once per process, so each launch runs in a child started in a
 * throwaway project whose own config/app.ts names a different app.
 */
import { Database } from 'bun:sqlite'
import { afterAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { desktopAppPaths } from '../src/webview-agent'
import { renderWebviewEntry } from '../src/webview-launcher'

const launcher = join(import.meta.dir, '../src/webview-launcher.ts')
const configEntry = join(import.meta.dir, '../../config/src/index.ts')
const root = mkdtempSync(join(tmpdir(), 'stacks-webview-config-'))
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'webview-config-fixture', private: true }))
mkdirSync(join(root, 'config'))
writeFileSync(join(root, 'config/app.ts'), `export default { name: 'From config/ On Disk' }\n`)
writeFileSync(join(root, 'compiled-app.ts'), `export default { name: 'Compiled Into The App' }\n`)
writeFileSync(join(root, 'compiled-broken.ts'), `throw new Error('cache config is broken')\n`)

afterAll(() => rmSync(root, { recursive: true, force: true }))

/** Launch the app in a child; the agent module reports the app name config resolved. */
async function launch(config: string | undefined, options: { awaitConfig?: boolean } = {}): Promise<{ code: number, seen?: string, opened: string, output: string }> {
  const script = join(root, `launch-${Math.random().toString(36).slice(2)}.ts`)
  writeFileSync(script, `
    import { runWebviewApp, } from ${JSON.stringify(launcher)}
    import { desktopAppPaths } from ${JSON.stringify(join(import.meta.dir, '../src/webview-agent.ts'))}
    let seen
    let opened = ''
    const code = await runWebviewApp({
      manifest: { appName: 'Fixture', appId: 'org.example.fixture', version: '0.3.0', runtime: process.execPath, window: { title: 'Fixture', width: 8, height: 6 } },
      views: { kind: 'none' },
      paths: desktopAppPaths('Fixture', { platform: process.platform, home: ${JSON.stringify(root)} + '/home-' + Math.random().toString(36).slice(2), env: {} }),
      argv: [],
      logWhenDetached: false,
      ${config ? `config: ${config},` : ''}
      module: async () => {
        const { config, overridesReady } = await import(${JSON.stringify(configEntry)})
        ${options.awaitConfig === false ? '' : 'await overridesReady'}
        seen = config.app.name
        return {}
      },
      spawn: (command) => {
        opened = command[command.indexOf('--title') + 1]
        return { exited: Promise.resolve(0), kill: () => {} }
      },
    })
    console.log('RESULT=' + JSON.stringify({ code, seen, opened }))
    process.exit(0)
  `)
  const child = Bun.spawn([process.execPath, script], {
    cwd: root,
    env: { ...process.env, SKIP_CONFIG_VALIDATION: 'true', SKIP_CONFIG_LOADING: '', APP_NAME: 'From The Environment' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const result = JSON.parse(stdout.match(/RESULT=(.*)/)?.[1] ?? '{"code":-1}') as { code: number, seen?: string, opened: string }
  return { ...result, output: `${stdout}\n${stderr}` }
}

describe('the config a web view app boots with', () => {
  test('a built app runs on its compiled-in config, not on what sits beside it, and logs it', async () => {
    const result = await launch(`{ app: () => import(${JSON.stringify(join(root, 'compiled-app.ts'))}) }`)
    expect(result.code, result.output).toBe(0)
    expect(result.seen).toBe('Compiled Into The App')
    expect(result.output).toContain('[Fixture] config: app.ts compiled into the app; framework defaults for the rest')
  }, 30_000)

  // The module imports config and does not wait for it, as a compiled app's
  // does: the line is still written, once loading has finished.
  test('without compiled-in config the log says where config came from', async () => {
    const result = await launch(undefined, { awaitConfig: false })
    expect(result.code, result.output).toBe(0)
    expect(result.output).toMatch(/\[Fixture\] config: app\.ts from .*\/config; framework defaults for the rest/)
  }, 30_000)

  test('a compiled-in file that throws stops the start and says why, in the log and a window', async () => {
    const result = await launch(`{ app: () => import(${JSON.stringify(join(root, 'compiled-app.ts'))}), cache: () => import(${JSON.stringify(join(root, 'compiled-broken.ts'))}) }`)
    expect(result.code, result.output).toBe(1)
    expect(result.seen).toBeUndefined()
    expect(result.opened).toBe('Fixture could not start')
    expect(result.output).toContain('config/cache.ts: cache config is broken')
  }, 30_000)
})

describe('the entrypoint the build writes', () => {
  test('names each config file in a static import(), so it is compiled in', () => {
    const entry = renderWebviewEntry({
      manifest: { appName: 'F', appId: 'org.f.app', version: '0.1.0', runtime: 'embedded', window: { title: 'F', width: 1, height: 2 } },
      configFiles: { 'app': '/p/config/app.ts', 'feature-flags': '/p/config/feature-flags.ts' },
      launcherModule: '@stacksjs/desktop-build',
    })
    expect(entry).toContain('config: {')
    expect(entry).toContain('"app": () => import("/p/config/app.ts"),')
    expect(entry).toContain('"feature-flags": () => import("/p/config/feature-flags.ts"),')
  })

  test('carries no config section when none is given', () => {
    const entry = renderWebviewEntry({ manifest: { appName: 'F', appId: 'org.f.app', version: '0.1.0', runtime: '/bin/craft', window: { title: 'F', width: 1, height: 2 } } })
    expect(entry).not.toContain('config: {')
  })
})

async function compileAuthFixture(auth: boolean): Promise<string> {
  const entry = join(root, `auth-${auth}.ts`)
  const binary = join(root, process.platform === 'win32' ? `auth-${auth}.exe` : `auth-${auth}`)
  const migration = join(root, '0000000001-create-users-table.sql')
  const module = join(root, 'auth-agent.ts')
  const shim = join(root, 'auth-launcher.ts')
  const databaseConfig = join(root, 'auth-database-config.ts')
  writeFileSync(migration, 'CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);')
  writeFileSync(module, `
    import { Database } from 'bun:sqlite'
    const database = new Database(process.env.DB_DATABASE_PATH, { readonly: true })
    const tables = database.query("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map(row => row.name)
    const columns = database.query("PRAGMA table_info(users)").all().map(row => row.name)
    console.log('AGENT_SCHEMA=' + JSON.stringify({ tables, columns }))
    database.close()
  `)
  writeFileSync(shim, `
    import { runWebviewApp as launch } from ${JSON.stringify(launcher)}
    import { desktopAppPaths } from ${JSON.stringify(join(import.meta.dir, '../src/webview-agent.ts'))}
    const paths = desktopAppPaths('AuthFixture', { platform: process.platform, home: process.env.FIXTURE_WORKSPACE, env: {} })
    export function runWebviewApp(options) {
      return launch({
        ...options, paths, argv: [], logWhenDetached: false,
        spawn: command => {
          console.log('WINDOW=' + command[command.indexOf('--title') + 1])
          return { exited: Promise.resolve(0), kill: () => {} }
        },
      })
    }
  `)
  writeFileSync(databaseConfig, `
    export default {
      default: 'sqlite',
      connections: { sqlite: { database: process.env.FIXTURE_OTHER_DATABASE_PATH || process.env.DB_DATABASE_PATH } },
    }
  `)
  writeFileSync(entry, renderWebviewEntry({
    manifest: { appName: 'AuthFixture', appId: 'org.example.authfixture', version: '0.1.0', runtime: process.execPath, window: { title: 'AuthFixture', width: 8, height: 6 } },
    launcherModule: shim,
    agentEntry: module,
    migrations: { '0000000001-create-users-table.sql': migration },
    databaseFilename: 'workspace.sqlite',
    databaseAuth: auth,
    configFiles: { database: databaseConfig },
  }))
  const build = Bun.spawn([process.execPath, 'build', '--compile', '--no-compile-autoload-bunfig', '--no-compile-autoload-dotenv', '--tsconfig-override', join(import.meta.dir, '../../../tsconfig.framework.json'), '--outfile', binary, entry], { cwd: root, stderr: 'pipe', stdout: 'pipe' })
  const [code, stderr] = await Promise.all([build.exited, new Response(build.stderr).text()])
  expect(code, stderr).toBe(0)
  return binary
}

async function launchAuthFixture(binary: string, workspace: string, otherDatabasePath?: string): Promise<{ code: number, output: string, schema?: { tables: string[], columns: string[] } }> {
  const child = Bun.spawn([binary], {
    cwd: root,
    env: { ...process.env, SKIP_CONFIG_VALIDATION: 'true', SKIP_CONFIG_LOADING: '', FIXTURE_WORKSPACE: workspace, FIXTURE_OTHER_DATABASE_PATH: otherDatabasePath ?? '' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const schema = stdout.match(/AGENT_SCHEMA=(.*)/)?.[1]
  return { code, output: `${stdout}\n${stderr}`, schema: schema ? JSON.parse(schema) : undefined }
}

function authWorkspaceDatabase(workspace: string): Database {
  const { dataDir } = desktopAppPaths('AuthFixture', { platform: process.platform, home: workspace, env: {} })
  return new Database(join(dataDir, 'workspace.sqlite'))
}

describe('managed auth in a compiled web view app', () => {
  test('launches fresh or upgrades an existing workspace before importing the agent module', async () => {
    const numberedOnly = await compileAuthFixture(false)
    const withAuth = await compileAuthFixture(true)
    const workspace = mkdtempSync(join(root, 'workspace-'))
    const before = await launchAuthFixture(numberedOnly, workspace)
    expect(before.code, before.output).toBe(0)
    expect(before.schema?.tables).toContain('users')
    expect(before.schema?.tables).not.toContain('oauth_flows')
    using database = authWorkspaceDatabase(workspace)
    database.run("INSERT INTO users (id, email) VALUES (17, 'kept@example.test')")

    for (const directory of [workspace, mkdtempSync(join(root, 'fresh-'))]) {
      const after = await launchAuthFixture(withAuth, directory)
      expect(after.code, after.output).toBe(0)
      expect(after.schema?.tables).toContain('oauth_flows')
      expect(after.schema?.tables).toContain('auth_browser_sessions')
      expect(after.schema?.columns).toContain('email_verified_at')
    }
    expect(database.query('SELECT email FROM users WHERE id = 17').get()).toEqual({ email: 'kept@example.test' })
    const repeat = await launchAuthFixture(withAuth, workspace)
    expect(repeat.code, repeat.output).toBe(0)
  }, 60_000)

  test('stops before loading the agent when it cannot initialize managed auth on the workspace', async () => {
    const withAuth = await compileAuthFixture(true)
    const foreignDatabase = join(root, 'foreign.sqlite')
    const workspace = mkdtempSync(join(root, 'mismatch-'))
    const mismatch = await launchAuthFixture(withAuth, workspace, foreignDatabase)
    expect(mismatch.code, mismatch.output).toBe(1)
    expect(mismatch.schema).toBeUndefined()
    expect(mismatch.output).toContain('WINDOW=AuthFixture could not start')
    expect(mismatch.output).toContain('managed auth schema requires the webview SQLite database')
    expect(existsSync(foreignDatabase)).toBe(false)

    using database = authWorkspaceDatabase(workspace)
    database.run('CREATE TABLE auth_browser_sessions (id TEXT PRIMARY KEY)')
    const failed = await launchAuthFixture(withAuth, workspace)
    expect(failed.code, failed.output).toBe(1)
    expect(failed.schema).toBeUndefined()
    expect(failed.output).toContain('WINDOW=AuthFixture could not start')
    expect(failed.output).toContain('no such column: user_id')
  }, 60_000)
})
