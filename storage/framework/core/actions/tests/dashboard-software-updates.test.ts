import { expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { registerProject } from '@stacksjs/path'
import { dashboardSoftwareUpdateRoutes } from '../src/dev/dashboard-software-updates'

test('the guarded updater runs the current project first and records each Buddy result', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'dashboard-upgrade-'))
  const previousHome = process.env.STACKS_HOME
  process.env.STACKS_HOME = join(workspace, 'state')
  const origin = 'http://localhost:3039'
  const path = '/__buddy/software-update'
  const runLog = join(workspace, 'invocations')
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
    expect((await install([other.id, 'current'])).status).toBe(202)
    expect((await install(['current'])).status).toBe(409)

    const restarted = dashboardSoftwareUpdateRoutes(options)
    const deadline = Date.now() + 10_000
    let update: { running: boolean, projects: Array<{ status: string, message?: string }> } | null = null
    while (Date.now() < deadline) {
      const status = await restarted[path](new Request(origin + path))
      update = (await status.json() as { update: typeof update }).update
      if (update && !update.running)
        break
      await Bun.sleep(100)
    }

    expect(update?.running).toBe(false)
    expect(update?.projects.map(project => project.status)).toEqual(['complete', 'failed'])
    expect(update?.projects[1]?.message).toContain('status 7')
    const afterFailure = await restarted[path](new Request(`${origin}${path}?check=1`))
    const retry = (await afterFailure.json() as { projects: Array<{ id: string, installed: string, latest: string, available: boolean }> }).projects.find(project => project.id === other.id)
    expect(retry).toMatchObject({ installed: '1.2.0', latest: '1.2.0', available: true })
    expect((await Bun.file(runLog).text()).trim().split('\n')).toEqual([
      'current upgrade --version 1.1.0 --no-interaction',
      'other upgrade --version 1.2.0 --no-interaction',
    ])
  }
  finally {
    if (previousHome === undefined)
      delete process.env.STACKS_HOME
    else
      process.env.STACKS_HOME = previousHome
    rmSync(workspace, { recursive: true, force: true })
  }
})
