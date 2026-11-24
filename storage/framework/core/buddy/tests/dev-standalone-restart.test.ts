import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isProcessAlive } from '@stacksjs/path'
import { runningAppDevSessions } from '../../actions/src/dev/app-session-control'
import { restartUpdatedProject } from '../../actions/src/dev/dashboard-restart'

interface Listener {
  port: number
  pid: number
  version: string
}

async function waitFor<T>(read: () => T | Promise<T>): Promise<T> {
  const deadline = Date.now() + 10_000
  for (;;) {
    try {
      return await read()
    }
    catch (error) {
      if (Date.now() >= deadline)
        throw error
      await Bun.sleep(50)
    }
  }
}

test.each([
  [['dev', 'frontend'], ['dev', 'api']],
  [['dev:frontend'], ['dev:api', '--no-watch-types']],
])('Software Update can restart separate %j and %j sessions on their original ports', async (frontend, api) => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-standalone-dev-'))
  const actions = join(root, 'storage/framework/core/actions/src/dev')
  const children: Array<ReturnType<typeof Bun.spawn>> = []
  const occupied = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('unrelated') })
  try {
    await Promise.all([mkdir(actions, { recursive: true }), mkdir(join(root, 'config'))])
    await Promise.all([
      writeFile(join(root, 'package.json'), '{"name":"standalone-restart-fixture"}'),
      writeFile(join(root, 'config/app.ts'), 'export default {}'),
      writeFile(join(root, 'bunfig.toml'), 'preload = []\n'),
      writeFile(join(root, 'version.txt'), 'before'),
      ...(['views', 'api'] as const).map(name => writeFile(join(actions, `${name}.ts`), `
const version = await Bun.file('version.txt').text()
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.${name === 'api' ? 'PORT_API' : 'PORT'}),
  fetch: () => Response.json({ port: server.port, pid: process.pid, version }),
})
${name === 'api' ? "process.send({ type: 'stacks:api-ready', port: server.port })" : ''}
await Bun.write('${name}-ready.json', JSON.stringify({ port: server.port, pid: process.pid, version }))
`)),
    ])
    for (const args of [frontend, api]) {
      children.push(Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/dev-defaults-preflight.ts'), ...args], {
        cwd: root,
        env: {
          ...process.env,
          PORT: String(occupied.port),
          PORT_API: '0',
          STACKS_HOME: join(root, 'state'),
          STACKS_DEV_NO_OPEN: '1',
        },
        stdout: 'ignore',
        stderr: 'inherit',
      }))
    }
    const [views, backend] = await Promise.all(['views', 'api'].map(name => waitFor(async () => {
      return await Bun.file(join(root, `${name}-ready.json`)).json() as Listener
    })))
    expect(runningAppDevSessions(root).map(session => session.pid).sort()).toEqual(children.map(child => child.pid).sort())
    expect(views!.port).not.toBe(occupied.port)
    await writeFile(join(root, 'version.txt'), 'after')

    await restartUpdatedProject(root)

    for (const before of [views!, backend!]) {
      const response = await fetch(`http://127.0.0.1:${before.port}`)
      const after = await response.json() as Listener
      expect(after).toMatchObject({ port: before.port, version: 'after' })
      expect(after.pid).not.toBe(before.pid)
      expect(isProcessAlive(before.pid)).toBe(false)
    }
    expect(await (await fetch(occupied.url)).text()).toBe('unrelated')
    for (const child of children)
      child.kill('SIGTERM')
    expect(await Promise.all(children.map(child => child.exited))).toEqual([0, 0])
    expect(runningAppDevSessions(root)).toEqual([])
  }
  finally {
    for (const child of children)
      child.kill('SIGKILL')
    await Promise.all(children.map(child => child.exited))
    await occupied.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
