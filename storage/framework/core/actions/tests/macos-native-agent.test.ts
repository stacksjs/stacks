import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { resolveMacosDesktop } from '@stacksjs/desktop-build'
import { appBundleFiles, appMigrationFiles, craftSupportsWebkit, macosAgentDevManifest, macosAgentEntry } from '../src/build/macos-native'

/**
 * The build side of `macos.agent` and `macos.webkit`: which routes the agent
 * bundles, the manifest a development run starts from, and whether the Craft
 * in use can link WebKit at all.
 */

const browser = { appName: 'Browser', bundleId: 'com.stacksjs.browser', nativeScreens: ['Main'], agent: true } as const

describe('craftSupportsWebkit', () => {
  test('recognises the option in source and once minified', () => {
    expect(craftSupportsWebkit('if (options.webkit) args.push("-framework", "WebKit")')).toBe(true)
    expect(craftSupportsWebkit('e.webkit&&t.push("-framework","WebKit")')).toBe(true)
    expect(craftSupportsWebkit('const { outdir, webkit } = options')).toBe(true)
  })

  test('a host that only mentions WebKit in a comment does not count', () => {
    expect(craftSupportsWebkit('/** Compile Craft\'s AppKit host. No WebKit. */')).toBe(false)
  })

  /*
   * The real question: does the craft-native this framework resolves take the
   * option yet? Craft is adding it separately; until a release carries it, this
   * says so instead of passing on a host that would build without WebKit.
   */
  let source = ''
  try {
    const desktop = Bun.resolveSync('@stacksjs/desktop-build/package.json', import.meta.dir)
    source = readFileSync(Bun.resolveSync('craft-native/macos', dirname(desktop)), 'utf8')
  }
  catch {}
  const supported = source !== '' && craftSupportsWebkit(source)
  if (!supported)
    console.warn('[macos-native-agent.test] skipping: the installed craft-native buildMacOSNative does not accept `webkit` yet. Raise the craft-native floor in core/desktop/package.json once a release links WebKit.')
  test.skipIf(!supported)('the installed craft-native links WebKit when asked', () => {
    expect(craftSupportsWebkit(source)).toBe(true)
  })
})

describe('the agent entry', () => {
  test('app/Desktop/Agent.ts by convention, nothing when the project has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-agent-entry-'))
    try {
      const config = resolveMacosDesktop(browser, '1.0.0')
      expect(macosAgentEntry(root, config)).toBeUndefined()
      mkdirSync(join(root, 'app/Desktop'), { recursive: true })
      writeFileSync(join(root, 'app/Desktop/Agent.ts'), '')
      expect(macosAgentEntry(root, config)).toBe(join(root, 'app/Desktop/Agent.ts'))
      expect(macosAgentEntry(root, resolveMacosDesktop({ ...browser, agent: false, url: 'https://x.example' }, '1.0.0'))).toBeUndefined()
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('a configured entry that does not exist fails the build by name', () => {
    expect(() => macosAgentEntry('/nowhere', resolveMacosDesktop({ ...browser, agent: { entry: 'agent/routes.ts' } }, '1.0.0'))).toThrow('agent/routes.ts')
  })
})

describe('the development manifest', () => {
  test('loads the project routes from the project, with the host and screens just built', () => {
    const manifest = macosAgentDevManifest(resolveMacosDesktop({ ...browser, agent: { port: 4810, staticDir: 'storage/web' } }, '1.2.0'), { root: '/p', host: '/p/host', nativeBundle: '/p/screens.js' })
    expect(manifest).toMatchObject({ appName: 'Browser', version: '1.2.0', host: '/p/host', nativeBundle: '/p/screens.js', port: 4810, staticDir: '/p/storage/web', projectRoot: '/p', appRoutes: true })
    expect(manifest.hostArguments).not.toContain('--api-url')
  })

  test('names each runtime resource by its path in the project', () => {
    const config = resolveMacosDesktop({ ...browser, agent: { resources: { lists: 'node_modules/lib/webkit', 'rules.json': '/abs/rules.json' } } }, '1.0.0')
    expect(macosAgentDevManifest(config, { root: '/p', host: '/h', nativeBundle: '/s' }).resources).toEqual({ 'lists': '/p/node_modules/lib/webkit', 'rules.json': '/abs/rules.json' })
    expect(macosAgentDevManifest(resolveMacosDesktop({ ...browser, agent: true }, '1.0.0'), { root: '/p', host: '/h', nativeBundle: '/s' }).resources).toBeUndefined()
  })

  test('appRoutes: false serves only the agent entry', () => {
    expect(macosAgentDevManifest(resolveMacosDesktop({ ...browser, agent: { appRoutes: false } }, '1.0.0'), { root: '/p', host: '/h', nativeBundle: '/s' }).appRoutes).toBe(false)
  })
})

// stacksjs/stacks#3368: what a compiled app carries of the project, the same
// for the macOS agent and the web view one.
describe('appBundleFiles', () => {
  test('the registry\'s route files, the actions they and the agent name, and every middleware', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-app-bundle-'))
    try {
      const put = (path: string, body: string) => {
        mkdirSync(dirname(join(root, path)), { recursive: true })
        writeFileSync(join(root, path), body)
      }
      put('app/Routes.ts', "export default { api: { path: 'api', middleware: 'auth' }, web: 'web' }\n")
      put('routes/api.ts', "route.post('/queue', 'Actions/QueueAction')\n")
      put('routes/web.ts', "route.get('/', 'Actions/HomeAction')\n")
      put('app/Desktop/Agent.ts', "route.get('/native', 'Actions/NativeAction')\n")
      put('app/Actions/QueueAction.ts', 'export default {}\n')
      put('app/Actions/NativeAction.ts', 'export default {}\n')
      put('storage/framework/defaults/app/Actions/HomeAction.ts', 'export default {}\n')
      put('storage/framework/defaults/app/Middleware/Auth.ts', 'export default {}\n')
      put('app/Middleware/Auth.ts', 'export default {}\n')
      put('app/Middleware/Team.ts', 'export default {}\n')

      const files = await appBundleFiles(root, [join(root, 'app/Desktop/Agent.ts')])

      expect(files.routes).toEqual([
        { file: join(root, 'routes/api.ts'), prefix: '/api', middleware: ['auth'] },
        { file: join(root, 'routes/web.ts') },
      ])
      expect(files.actions).toEqual({
        'Actions/QueueAction': join(root, 'app/Actions/QueueAction.ts'),
        'Actions/HomeAction': join(root, 'storage/framework/defaults/app/Actions/HomeAction.ts'),
        'Actions/NativeAction': join(root, 'app/Actions/NativeAction.ts'),
      })
      // The app's middleware replaces the default of the same name.
      expect(files.middleware).toEqual({ Auth: join(root, 'app/Middleware/Auth.ts'), Team: join(root, 'app/Middleware/Team.ts') })
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

// stacksjs/stacks#3368: the migrations a compiled app applies are exactly
// the ones buddy migrate applies, which skips those of features the app has
// not installed. So they are read from a scratch run, not chosen here.
describe('appMigrationFiles', () => {
  const project = () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-app-migrations-'))
    mkdirSync(join(root, 'database/migrations'), { recursive: true })
    for (const name of ['0000000001-create-posts-table.sql', '0000000002-create-carts-table.sql', '0000000003-create-tags-table.sql'])
      writeFileSync(join(root, 'database/migrations', name), '-- sql\n')
    return root
  }

  test('lists what buddy migrate applied to a scratch database, in order, as files', async () => {
    const root = project()
    const calls: Array<{ command: string[], env: Record<string, string | undefined> }> = []
    try {
      const files = await appMigrationFiles(root, (command, env) => {
        calls.push({ command, env })
        const db = new Database(env.DB_DATABASE_PATH!)
        db.exec('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration TEXT)')
        // The commerce table is left out, as buddy migrate leaves out an uninstalled feature.
        db.exec("INSERT INTO migrations (migration) VALUES ('0000000001-create-posts-table.sql'), ('0000000003-create-tags-table.sql')")
        db.close()
        return { exitCode: 0, output: '' }
      })

      expect(files).toEqual({
        '0000000001-create-posts-table.sql': join(root, 'database/migrations/0000000001-create-posts-table.sql'),
        '0000000003-create-tags-table.sql': join(root, 'database/migrations/0000000003-create-tags-table.sql'),
      })
      expect(calls[0]!.command).toEqual(['./buddy', 'migrate', '--no-generate'])
      expect(calls[0]!.env.DB_CONNECTION).toBe('sqlite')
      // A scratch file, never the project's own database.
      expect(calls[0]!.env.DB_DATABASE_PATH!.startsWith(root)).toBe(false)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('fails the build when buddy migrate fails, with its output', async () => {
    const root = project()
    try {
      await expect(appMigrationFiles(root, () => ({ exitCode: 1, output: 'no such column: title' }))).rejects.toThrow('no such column: title')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('fails the build when the ledger names a migration that is not on disk', async () => {
    const root = project()
    try {
      await expect(appMigrationFiles(root, (_command, env) => {
        const db = new Database(env.DB_DATABASE_PATH!)
        db.exec("CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration TEXT); INSERT INTO migrations (migration) VALUES ('0000000009-gone.sql')")
        db.close()
        return { exitCode: 0, output: '' }
      })).rejects.toThrow('0000000009-gone.sql')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
