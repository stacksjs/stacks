import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test.each(['lazy', 'eager', 'stale'] as const)('dashboard boots globals for %s actions without weakening auth or CSRF', async (loading) => {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'stacks-dashboard-runtime-'))
  let child: ReturnType<typeof Bun.spawn> | undefined
  const write = (path: string, contents: string) => {
    const target = join(root, path)
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, contents)
  }
  try {
    cpSync(join(checkout, 'storage/framework/defaults'), join(root, 'storage/framework/defaults'), { recursive: true })
    symlinkSync(join(checkout, 'node_modules'), join(root, 'node_modules'), 'dir')
    write('package.json', '{"name":"dashboard-runtime-fixture","type":"module"}')
    write('bunfig.toml', '# No application preloads in this isolated worker.\n')
    // The proxy is a system boundary: a regression must never create real
    // certificates, change hosts files, or talk to a developer's rpx daemon.
    write('proxy-guard.ts', `import { mock } from 'bun:test'
const unexpected = () => { process.stdout.write('UNEXPECTED_PROXY_CALL'); throw new Error('Proxy forbidden in fixture') }
mock.module('@stacksjs/rpx', () => ({ isDaemonRunning: unexpected, startProxies: unexpected, writeEntry: unexpected }))`)
    if (loading === 'stale') {
      for (const name of ['functions', 'models']) {
        const barrel = `storage/framework/auto-imports/${name}.ts`
        write(barrel, 'export {}')
        utimesSync(join(root, barrel), new Date(0), new Date(0))
      }
    }
    write('config/database.ts', `export default { default: 'sqlite', connections: { sqlite: { database: ${JSON.stringify(join(root, 'fixture.sqlite'))} } } }`)
    write('app/Models/RuntimeProbe.ts', `import { defineModel } from '@stacksjs/orm'
export default defineModel({ name: 'RuntimeProbe', table: 'runtime_probes', attributes: { name: { fillable: true } } })`)
    write('resources/functions/runtime-label.ts', `export function runtimeLabel() { return 'dashboard fixture' }`)
    write('app/Routes.ts', `${loading === 'eager' ? "import './Actions/RuntimeProbeAction'" : ''}\nexport default { api: 'api' }`)
    write('app/Gates.ts', `export default { gates: { 'fixture-access': (_user, label) => label === runtimeLabel() } }`)
    write('routes/api.ts', `import { route } from '@stacksjs/router'
route.get('/ready', () => Response.json({ ready: true }))
route.get('/runtime', 'Actions/RuntimeProbeAction')
route.get('/private', () => Response.json({ private: true })).middleware('auth')
route.post('/mutate', 'Actions/RuntimeProbeAction')`)
    write('app/Actions/RuntimeProbeAction.ts', `import { Gate } from '@stacksjs/auth'
export default new Action({
  name: 'RuntimeProbeAction',
  async handle() { return response.json({ label: runtimeLabel(), rows: await RuntimeProbe.all(),
    allowed: await Gate.allows('fixture-access', { id: 1 }, 'dashboard fixture'),
    denied: await Gate.allows('fixture-access', { id: 1 }, 'wrong label'),
  }) },
})`)
    const db = new Database(join(root, 'fixture.sqlite'))
    db.exec("CREATE TABLE runtime_probes (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO runtime_probes VALUES (1, 'isolated row')")
    db.close()

    const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
    const port = reservation.port!
    await reservation.stop(true)
    child = Bun.spawn([
      process.execPath, '--no-env-file', '--preload', join(root, 'proxy-guard.ts'),
      '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
      join(checkout, 'storage/framework/core/actions/src/dev/dashboard.ts'), '--verbose',
    ], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        APP_ENV: 'test', NODE_ENV: 'test', APP_URL: 'http://127.0.0.1:4320', PORT_ADMIN: String(port),
        STACKS_DASHBOARD_WORKER: '1', STACKS_NO_NATIVE: '1', STACKS_DEV_SERVER: '1',
        STACKS_DEV_AUTO_MIGRATE: '0', STACKS_SKIP_DEFAULT_ROUTES: '1',
        DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'fixture.sqlite'),
      },
      stdout: 'pipe', stderr: 'pipe',
    })
    let transcript = ''
    const output = (async () => {
      const decoder = new TextDecoder()
      for await (const chunk of child.stdout as ReadableStream<Uint8Array>)
        transcript += decoder.decode(chunk, { stream: true })
      transcript += decoder.decode()
      return transcript
    })()
    const errors = new Response(child.stderr).text()
    const origin = `http://127.0.0.1:${port}`
    let ready = false
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null)
        throw new Error(`Dashboard exited: ${await output}\n${await errors}`)
      ready = await fetch(`${origin}/api/ready`).then(res => res.status === 200, () => false)
      if (ready) break
      await Bun.sleep(100)
    }
    expect(ready).toBe(true)
    const guest = await fetch(`${origin}/api/private`)
    expect(guest.status).toBe(401)
    const csrf = await fetch(`${origin}/api/mutate`, { method: 'POST', body: '{}' })
    expect(csrf.status).toBe(403)
    const response = await fetch(`${origin}/api/runtime`)
    const body = await response.json()
    expect(response.status, JSON.stringify(body)).toBe(200)
    expect(body.label).toBe('dashboard fixture')
    expect(body.rows).toEqual([{ id: 1, name: 'isolated row' }])
    expect(body.allowed).toBe(true)
    expect(body.denied).toBe(false)
    // HTTP starts before proxy setup. Wait for the final startup message so
    // an early successful request cannot hide subsequent system side effects.
    for (let attempt = 0; attempt < 100 && !transcript.includes('Native window disabled'); attempt++)
      await Bun.sleep(100)
    expect(transcript).toContain('Native window disabled')
    expect(transcript).not.toContain('UNEXPECTED_PROXY_CALL')
    expect(transcript).not.toContain('https://dashboard.')
  }
  finally {
    child?.kill()
    if (child) await child.exited
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
