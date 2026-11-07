import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test.each(['lazy', 'eager', 'stale', 'defaults'] as const)('dashboard boots globals for %s actions without weakening auth or CSRF', async (loading) => {
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
    for (const file of ['routes.ts', 'route-types.d.ts', 'layout-types.d.ts'])
      write(`storage/framework/stx/${file}`, '// Application route artifact\nexport {}\n')
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
    write('config/dashboard.ts', `export default { nav: [{ title: 'Sample', items: [{ label: 'Alpha', href: '/alpha' }, { label: 'Beta', href: '/beta' }, { label: 'Gamma', href: '/gamma' }] }] }`)
    for (const page of ['order-test', 'alpha', 'beta', 'gamma'])
      write(`resources/views/dashboard/${page}.stx`, `@extends('layouts/default')\n@section('content')\n<h1>Sidebar ordering fixture</h1>\n@endsection`)
    write('app/Models/RuntimeProbe.ts', `import { defineModel } from '@stacksjs/orm'
export default defineModel({ name: 'RuntimeProbe', table: 'runtime_probes', attributes: { name: { fillable: true } } })`)
    write('app/Models/RuntimeSecond.ts', `import { defineModel } from '@stacksjs/orm'
export default defineModel({ name: 'RuntimeSecond', table: 'runtime_seconds', attributes: { name: { fillable: true } } })`)
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
    db.exec('CREATE TABLE runtime_seconds (id INTEGER PRIMARY KEY, name TEXT)')
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
        STACKS_DEV_AUTO_MIGRATE: '0', STACKS_SKIP_DEFAULT_ROUTES: loading === 'defaults' ? '0' : '1',
        DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'fixture.sqlite'),
        XDG_CONFIG_HOME: join(root, 'machine-config'),
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
    // An app can skip framework routes and still open its developer dashboard.
    const definitions = await fetch(`${origin}/api/dashboard/jobs/definitions`)
    expect(definitions.status).toBe(200)
    expect(Array.isArray((await definitions.json()).data)).toBe(true)
    const sidebar = await fetch(`${origin}/api/dashboard/sidebar-order`)
    expect(sidebar.status).toBe(200)
    expect(sidebar.headers.get('cache-control')).toBe('private, no-store')
    const initialSidebar = await sidebar.json()
    expect(initialSidebar.order).toEqual({ version: 1, sections: [], items: {} })
    const csrfCookie = sidebar.headers.getSetCookie().find(cookie => cookie.startsWith('X-CSRF-Token='))!.split(';')[0]!
    const token = decodeURIComponent(csrfCookie.slice('X-CSRF-Token='.length))
    const personalOrder = { version: 1, sections: ['data', 'top'], items: {} }
    const blockedSave = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: personalOrder }) })
    expect(blockedSave.status).toBe(403)
    const saveHeaders = { 'Content-Type': 'application/json', 'Cookie': csrfCookie, 'X-CSRF-Token': token }
    const changedViewer = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: saveHeaders, body: JSON.stringify({ order: personalOrder, scope: 'another-viewer' }) })
    expect(changedViewer.status).toBe(409)
    const save = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: saveHeaders, body: JSON.stringify({ order: personalOrder, scope: initialSidebar.scope }) })
    expect(save.status).toBe(200)
    expect((await (await fetch(`${origin}/api/dashboard/sidebar-order`)).json()).order).toEqual(personalOrder)
    const invalidSave = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: saveHeaders, body: JSON.stringify({ order: { version: 3 }, scope: initialSidebar.scope }) })
    expect(invalidSave.status).toBe(422)
    if (loading === 'defaults') {
      const home = await fetch(`${origin}/api/dashboard/home`)
      expect(home.status).toBe(200)
    }
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
    if (loading === 'lazy' && process.env.STACKS_BROWSER_TESTS === '1') {
      const { verifySidebarOrdering } = await import('./fixtures/dashboard-sidebar-order-browser')
      await verifySidebarOrdering(origin)
    }
    // HTTP starts before proxy setup. Wait for the final startup message so
    // an early successful request cannot hide subsequent system side effects.
    for (let attempt = 0; attempt < 100 && !transcript.includes('Native window disabled'); attempt++)
      await Bun.sleep(100)
    expect(transcript).toContain('Native window disabled')
    expect(transcript).not.toContain('UNEXPECTED_PROXY_CALL')
    expect(transcript).not.toContain('https://dashboard.')
    for (const file of ['routes.ts', 'route-types.d.ts', 'layout-types.d.ts'])
      expect(readFileSync(join(root, `storage/framework/stx/${file}`), 'utf8')).toBe('// Application route artifact\nexport {}\n')
  }
  finally {
    child?.kill()
    if (child) await child.exited
    rmSync(root, { recursive: true, force: true })
  }
}, 120_000)
