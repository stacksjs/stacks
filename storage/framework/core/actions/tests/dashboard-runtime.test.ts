import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { networkInterfaces, tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

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
    // Editor integrations may have local development dependencies installed;
    // the disposable application needs framework defaults, not those trees.
    cpSync(join(checkout, 'storage/framework/defaults'), join(root, 'storage/framework/defaults'), {
      recursive: true,
      filter: source => basename(source) !== 'node_modules',
    })
    symlinkSync(join(checkout, 'node_modules'), join(root, 'node_modules'), 'dir')
    write('package.json', '{"name":"dashboard-runtime-fixture","type":"module"}')
    write('bunfig.toml', '# No application preloads in this isolated worker.\n')
    for (const icon of ['favicon.svg', 'favicon-dark.svg']) {
      const path = `public/images/logos/${icon}`
      write(path, readFileSync(join(checkout, path), 'utf8'))
    }
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
export default defineModel({ name: 'RuntimeProbe', table: 'runtime_probes', dashboard: { writes: ['update'] }, attributes: { name: { fillable: true } } })`)
    write('app/Models/RuntimeSecond.ts', `import { defineModel } from '@stacksjs/orm'
export default defineModel({ name: 'RuntimeSecond', table: 'runtime_seconds', primaryKey: 'worker_id', autoIncrement: false, dashboard: { writes: ['store', 'update', 'destroy'] }, hasMany: ['RuntimeTask'], traits: { useTimestamps: false }, attributes: { worker_id: { fillable: true }, name: { fillable: true } } })`)
    write('app/Models/RuntimeTask.ts', `import { defineModel } from '@stacksjs/orm'
export default defineModel({ name: 'RuntimeTask', table: 'runtime_tasks', primaryKey: 'task_code', autoIncrement: false, dashboard: { writes: ['store', 'update', 'destroy'] }, belongsTo: ['RuntimeSecond'], traits: { useTimestamps: false }, attributes: { task_code: { fillable: true }, title: { fillable: true } } })`)
    write('app/Models/FailedJob.ts', `import { defineModel } from '@stacksjs/orm'
export default defineModel({ name: 'FailedJob', table: 'failed_jobs', dashboard: { highlight: true, label: 'Failed jobs' }, attributes: {} })`)
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
    db.exec("CREATE TABLE runtime_seconds (worker_id TEXT PRIMARY KEY, name TEXT); INSERT INTO runtime_seconds VALUES ('worker:one', 'First worker'), ('worker:two', 'Second worker')")
    db.exec("CREATE TABLE runtime_tasks (task_code TEXT PRIMARY KEY, runtime_second_id TEXT, title TEXT); INSERT INTO runtime_tasks VALUES ('task:a', 'worker:one', 'Alpha'), ('task:b', 'worker:one', 'Beta')")
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
    const lanAddress = Object.values(networkInterfaces()).flat().find(address => address?.family === 'IPv4' && !address.internal)?.address
    if (lanAddress) {
      const remote = await fetch(`http://${lanAddress}:${port}/api/ready`, {
        headers: { 'x-forwarded-for': '127.0.0.1' },
        signal: AbortSignal.timeout(2000),
      }).catch(() => null)
      if (remote) expect(remote.status).toBe(404)
    }
    // An app can skip framework routes and still open its developer dashboard.
    const definitions = await fetch(`${origin}/api/dashboard/jobs/definitions`)
    expect(definitions.status).toBe(200)
    expect(Array.isArray((await definitions.json()).data)).toBe(true)
    const customKeyList = await fetch(`${origin}/api/dashboard/models/runtime-second`)
    expect(customKeyList.status).toBe(200)
    const modelList = await customKeyList.json()
    expect(modelList.primaryKey).toBe('worker_id')
    expect(modelList.sort).toBe('worker_id')
    expect(modelList.rows.map((row: { worker_id: string }) => row.worker_id)).toEqual(['worker:two', 'worker:one'])
    const customKeyRecord = await fetch(`${origin}/api/dashboard/models/runtime-second?record=worker%3Aone`)
    expect(customKeyRecord.status).toBe(200)
    expect((await customKeyRecord.json()).rows).toEqual([{ worker_id: 'worker:one', name: 'First worker' }])
    const ordinaryRecord = await fetch(`${origin}/api/dashboard/models/runtime-probe?record=1`)
    expect(ordinaryRecord.status).toBe(200)
    expect((await ordinaryRecord.json()).rows).toEqual([{ id: 1, name: 'isolated row' }])
    const manifest = await Bun.file(join(root, 'storage/framework/runtime/dashboard/.discovered-models.json')).json()
    expect(manifest.models.find((model: { name: string }) => model.name === 'FailedJob')?.dashboard?.label).toBe('Failed jobs')
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
    const changedViewer = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: saveHeaders, body: JSON.stringify({ order: personalOrder, scope: '0'.repeat(32) }) })
    expect(changedViewer.status).toBe(409)
    const save = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: saveHeaders, body: JSON.stringify({ order: personalOrder, scope: initialSidebar.scope }) })
    expect(save.status).toBe(200)
    expect((await (await fetch(`${origin}/api/dashboard/sidebar-order`)).json()).order).toEqual(personalOrder)
    const invalidSave = await fetch(`${origin}/api/dashboard/sidebar-order`, { method: 'PUT', headers: saveHeaders, body: JSON.stringify({ order: { version: 3 }, scope: initialSidebar.scope }) })
    expect(invalidSave.status).toBe(422)
    // Create, edit and delete take a model's declared string key (stacksjs/stacks#3350).
    const customKeyWrites = (await (await fetch(`${origin}/api/dashboard/models/runtime-second`)).json()).writeCapabilities
    expect(customKeyWrites).toMatchObject({ create: true, update: true, destroy: true })
    const created = await fetch(`${origin}/api/dashboard/models/runtime-second`, { method: 'POST', headers: saveHeaders, body: JSON.stringify({ fields: { worker_id: 'worker:three', name: 'Third worker' } }) })
    expect(created.status, await created.clone().text()).toBe(200)
    expect((await created.json()).id).toBe('worker:three')
    const edited = await fetch(`${origin}/api/dashboard/models/runtime-second/worker%3Aone`, { method: 'PATCH', headers: saveHeaders, body: JSON.stringify({ fields: { name: 'Renamed worker' } }) })
    expect(edited.status, await edited.clone().text()).toBe(200)
    expect(await edited.json()).toMatchObject({ ok: true, id: 'worker:one' })
    const deleted = await fetch(`${origin}/api/dashboard/models/runtime-second/worker%3Atwo`, { method: 'DELETE', headers: saveHeaders })
    expect(deleted.status, await deleted.clone().text()).toBe(200)
    const missing = await fetch(`${origin}/api/dashboard/models/runtime-second/worker%3Anone`, { method: 'DELETE', headers: saveHeaders })
    expect(missing.status).toBe(404)
    const afterWrites = (await (await fetch(`${origin}/api/dashboard/models/runtime-second`)).json()).rows
    expect(afterWrites).toEqual([{ worker_id: 'worker:three', name: 'Third worker' }, { worker_id: 'worker:one', name: 'Renamed worker' }])
    // Related panels and the combined save take declared keys,
    // on the record and on its related rows alike (stacksjs/stacks#3350).
    const tasksPanel = async () => ((await (await fetch(`${origin}/api/dashboard/models/runtime-second/worker%3Aone/related`)).json()).panels as Array<{ slug: string, rows: Array<{ id: string }>, canCreate: boolean, canUpdate: boolean, canDestroy: boolean, values: Record<string, { title?: string }> }>).find(panel => panel.slug === 'runtime-task')!
    const before = await tasksPanel()
    expect(before.rows.map(row => row.id)).toEqual(['task:b', 'task:a'])
    expect(before).toMatchObject({ canCreate: true, canUpdate: true, canDestroy: true })
    const savedTogether = await fetch(`${origin}/api/dashboard/models/runtime-second/worker%3Aone/save`, {
      method: 'PATCH',
      headers: saveHeaders,
      body: JSON.stringify({ fields: { name: 'Saved worker' }, related: [{ slug: 'runtime-task', create: [{ key: 'new-1', fields: { task_code: 'task:c', title: 'Gamma' } }], update: [{ id: 'task:a', fields: { title: 'Alpha, edited' } }], destroy: ['task:b'] }] }),
    })
    expect(savedTogether.status, await savedTogether.clone().text()).toBe(200)
    expect((await savedTogether.json()).related).toEqual([{ slug: 'runtime-task', created: [{ key: 'new-1', id: 'task:c' }], updated: ['task:a'], destroyed: ['task:b'], anonymized: [] }])
    const after = await tasksPanel()
    expect(after.rows.map(row => row.id)).toEqual(['task:c', 'task:a'])
    expect(after.values['task:a']?.title).toBe('Alpha, edited')
    const stranger = await fetch(`${origin}/api/dashboard/models/runtime-second/worker%3Athree/save`, { method: 'PATCH', headers: saveHeaders, body: JSON.stringify({ related: [{ slug: 'runtime-task', destroy: ['task:a'] }] }) })
    expect(stranger.status).toBe(404)
    // A numeric-id model still refuses a key that is not a number.
    const notANumber = await fetch(`${origin}/api/dashboard/models/runtime-probe/abc`, { method: 'PATCH', headers: saveHeaders, body: JSON.stringify({ fields: { name: 'x' } }) })
    expect(notANumber.status).toBe(400)
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
