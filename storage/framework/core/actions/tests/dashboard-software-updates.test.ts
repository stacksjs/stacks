import { expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { readProjectService, registerProject } from '@stacksjs/path'
import { dashboardSoftwareUpdateRoutes } from '../src/dev/dashboard-software-updates'

async function waitFor<T>(probe: () => Promise<T | null> | T | null): Promise<T> {
  const deadline = Date.now() + 10_000
  for (;;) {
    const value = await probe()
    if (value !== null)
      return value
    if (Date.now() >= deadline)
      throw new Error('Timed out waiting for the software update worker')
    await Bun.sleep(100)
  }
}

test('updates projects in order and restarts only successful updates on their existing ports', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'dashboard-upgrade-'))
  const previousHome = process.env.STACKS_HOME
  process.env.STACKS_HOME = join(workspace, 'state')
  const origin = 'http://localhost:3039'
  const path = '/__buddy/software-update'
  const runLog = join(workspace, 'invocations')
  const dashboards: Array<ReturnType<typeof Bun.spawn>> = []
  const entry = join(workspace, 'dashboard.ts')
  writeFileSync(entry, `
import { runDashboardSupervisor } from ${JSON.stringify(new URL('../src/dev/dashboard-supervisor.ts', import.meta.url).pathname)}
import { recordProjectService } from ${JSON.stringify(new URL('../../path/src/projects.ts', import.meta.url).pathname)}
if (process.env.STACKS_DASHBOARD_WORKER === '1') {
  const instance = crypto.randomUUID()
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: Number(process.env.PORT_ADMIN),
    fetch: () => new Response(null, { status: 204, headers: { 'x-stacks-dashboard': instance } }),
  })
  recordProjectService(process.cwd(), {
    name: 'dashboard',
    pid: Number(process.env.STACKS_DASHBOARD_SUPERVISOR_PID),
    port: server.port,
    url: server.url.href,
    startedAt: new Date().toISOString(),
    restartInstance: instance,
  })
  process.on('SIGTERM', () => process.exit(0))
}
else {
  process.exit(await runDashboardSupervisor(import.meta.path, []))
}
`)
  async function startDashboard(root: string) {
    dashboards.push(Bun.spawn([process.execPath, '--no-env-file', entry], {
      cwd: root,
      env: { ...process.env, STACKS_DASHBOARD_WORKER: '0', PORT_ADMIN: '0' },
      stdout: 'ignore',
      stderr: 'inherit',
    }))
    return await waitFor(() => readProjectService(root, 'dashboard'))
  }

  const fakeProject = (name: string, vendored: boolean, exit: number): string => {
    const root = join(workspace, name)
    const framework = vendored ? 'storage/framework/core/buddy' : 'node_modules/stacks'
    mkdirSync(join(root, framework), { recursive: true })
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config/app.ts'), 'export default {}')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name, ...(!vendored && { dependencies: { stacks: '1.0.0' } }) }))
    writeFileSync(join(root, framework, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    const shim = join(root, 'buddy')
    const partialInstall = exit ? `printf '%s' '{"version":"1.2.0"}' > node_modules/stacks/package.json` : ':'
    writeFileSync(shim, `#!/bin/sh\nprintf '%s %s\n' "${name}" "$*" >> "${runLog}"\nsleep 0.3\n${partialInstall}\nexit ${exit}\n`)
    chmodSync(shim, 0o700)
    return root
  }

  try {
    const root = fakeProject('current', true, 0)
    const other = registerProject(fakeProject('other', false, 7))!
    let validated = 0
    const options = {
      root,
      port: 3039,
      url: () => origin,
      validateWrite: async (request: Request) => {
        validated++
        if (request.headers.get('x-csrf-token') !== 'fixture')
          throw new Error('missing CSRF')
      },
      resolveRelease: async (source: 'vendored' | 'package') => source === 'vendored' ? '1.1.0' : '1.2.0',
    }
    const routes = dashboardSoftwareUpdateRoutes(options)
    const install = (projects: string[], token = 'fixture', requestOrigin = origin) =>
      routes[`${path}/install`](new Request(`${origin}${path}/install`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: requestOrigin, 'x-csrf-token': token },
        body: JSON.stringify({ projects }),
      }))

    const blocked = await install([other.id], 'fixture', 'https://unrelated.example')
    expect(blocked.status).toBe(403)
    expect(validated).toBe(0)
    expect((await install([other.id], '')).status).toBe(403)
    expect((await install(['/tmp/unknown'])).status).toBe(404)

    const check = await routes[path](new Request(`${origin}${path}?check=1`))
    const listing = await check.json() as { projects: Array<{ id: string, current: boolean, latest: string }> }
    expect(listing.projects.map(project => [project.id, project.current, project.latest])).toEqual([
      ['current', true, '1.1.0'],
      ['other', false, '1.2.0'],
    ])
    const accepted = await install([other.id, 'current'])
    expect(accepted.status).toBe(202)
    const { update: { id } } = await accepted.json() as { update: { id: string } }
    expect((await install(['current'])).status).toBe(409)

    const restarted = dashboardSoftwareUpdateRoutes(options)
    const restart = (updateId = id, token = 'fixture') =>
      restarted[`${path}/restart`](new Request(`${origin}${path}/restart`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, 'x-csrf-token': token },
        body: JSON.stringify({ updateId }),
      }))
    expect((await restart()).status).toBe(409)

    const operationResult = () => waitFor(async () => {
      const response = await restarted[path](new Request(origin + path))
      const { update } = await response.json() as {
        update: null | { running: boolean, restartAvailable: boolean, projects: Array<{ status: string, message?: string, restartStatus?: string }> }
      }
      return update && !update.running ? update : null
    })
    const update = await operationResult()
    expect(update.projects.map(project => project.status)).toEqual(['complete', 'failed'])
    expect(update.projects[1]?.message).toContain('status 7')
    const afterFailure = await restarted[path](new Request(`${origin}${path}?check=1`))
    const retry = (await afterFailure.json() as { projects: Array<{ id: string, installed: string, latest: string, available: boolean }> }).projects.find(project => project.id === other.id)
    expect(retry).toMatchObject({ installed: '1.2.0', latest: '1.2.0', available: true })
    expect((await Bun.file(runLog).text()).trim().split('\n')).toEqual([
      'current upgrade --version 1.1.0 --no-interaction',
      'other upgrade --version 1.2.0 --no-interaction',
    ])

    if (process.platform !== 'win32') {
      const [before, failedProject] = await Promise.all([startDashboard(root), startDashboard(other.path)])
      expect((await operationResult()).restartAvailable).toBe(true)
      expect((await restart(id, '')).status).toBe(403)
      expect((await restart('an older update')).status).toBe(409)
      expect((await restart()).status).toBe(202)
      expect((await restart()).status).toBe(409)

      const after = await operationResult()
      expect(after.projects).toMatchObject([{ status: 'complete', restartStatus: 'complete' }, { status: 'failed' }])
      expect(after.projects[1]?.restartStatus).toBeUndefined()
      expect(after.restartAvailable).toBe(false)
      expect(readProjectService(root, 'dashboard')).toMatchObject({ pid: before.pid, port: before.port })
      expect(readProjectService(root, 'dashboard')?.restartInstance).not.toBe(before.restartInstance)
      expect(readProjectService(other.path, 'dashboard')?.restartInstance).toBe(failedProject.restartInstance)
    }
  }
  finally {
    for (const dashboard of dashboards)
      dashboard.kill('SIGTERM')
    await Promise.all(dashboards.map(dashboard => dashboard.exited))
    if (previousHome === undefined)
      delete process.env.STACKS_HOME
    else
      process.env.STACKS_HOME = previousHome
    rmSync(workspace, { recursive: true, force: true })
  }
}, 30_000)
