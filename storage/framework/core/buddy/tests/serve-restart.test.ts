import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { isProcessAlive } from '@stacksjs/path'
import { runningAppSessions } from '../../actions/src/dev/app-session-control'
import { canRestartUpdatedProject, restartUpdatedProject } from '../../actions/src/dev/dashboard-restart'

async function freePort(): Promise<number> {
  const listener = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = listener.port!
  await listener.stop(true)
  return port
}

async function waitForBody(url: string): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const response = await fetch(url, { signal: AbortSignal.timeout(750) }).catch(() => null)
    if (response?.ok)
      return response.text()
    await Bun.sleep(100)
  }
  throw new Error(`No successful response from ${url}`)
}

test('Software Update restarts buddy serve and its API on the same ports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-serve-restart-'))
  const children: Array<ReturnType<typeof Bun.spawn>> = []
  const framework = resolve(import.meta.dir, '../../../../..')
  const views = join(root, 'resources/views')
  const actions = join(root, 'storage/framework/core/actions/src/serve')
  const apiFile = join(actions, 'api.ts')
  const versionedApi = (release: string) => `
const server = Bun.serve({
  hostname: process.env.API_HOST,
  port: Number(process.env.PORT),
  fetch: () => new Response('${release} ' + process.pid),
})
process.send({ type: 'stacks:api-ready', port: server.port })
`
  try {
    await Promise.all([views, actions, ...['config', 'components', 'layouts', 'partials'].map(dir => join(root, dir))]
      .map(dir => mkdir(dir, { recursive: true })))
    const bunfig = join(root, 'bunfig.toml')
    await Promise.all([
      symlink(join(framework, 'node_modules'), join(root, 'node_modules'), 'junction'),
      writeFile(bunfig, 'preload = []\n'),
      writeFile(join(root, 'package.json'), '{"name":"serve-restart-fixture"}'),
      writeFile(join(root, 'config/app.ts'), "export default { key: 'test-serve-restart' }"),
      writeFile(join(views, 'worker.stx'), '<script server>const pid = process.pid</script>\n<h1>worker {{ pid }}</h1>\n'),
      writeFile(apiFile, versionedApi('before')),
    ])
    const web = await freePort()
    let api = await freePort()
    while (api === web)
      api = await freePort()
    for (const [command, port] of [['serve', web], ['serve:api', api]]) {
      const entry = join(import.meta.dir, '../src/cli.ts')
      children.push(Bun.spawn([process.execPath, '--conditions=development', '--no-env-file', `--config=${bunfig}`, entry, String(command), '--port', String(port)], {
        cwd: root,
        env: {
          ...process.env,
          APP_ENV: 'test',
          STACKS_HOME: join(root, 'state'),
          DB_CONNECTION: 'sqlite',
          DB_DATABASE_PATH: ':memory:',
          HOST: '127.0.0.1',
          API_HOST: '127.0.0.1',
          PORT_API: String(api),
          SHUTDOWN_GRACE_MS: '200',
        },
        stdout: 'ignore',
        stderr: 'inherit',
      }))
    }
    const webUrl = `http://127.0.0.1:${web}`
    const [pageBefore, apiBefore] = await Promise.all([
      waitForBody(`${webUrl}/worker`),
      waitForBody(`http://127.0.0.1:${api}/api/fixture`),
    ])
    expect(canRestartUpdatedProject(root)).toBe(true)
    expect(runningAppSessions(root).map(session => session.pid).sort()).toEqual(children.map(child => child.pid).sort())
    expect(pageBefore).toMatch(/<h1>worker \d+<\/h1>/)
    expect(apiBefore).toMatch(/^before \d+$/)
    await writeFile(apiFile, versionedApi('after'))

    await restartUpdatedProject(root)

    const pageAfter = await waitForBody(`${webUrl}/worker`)
    const apiAfter = await waitForBody(`${webUrl}/api/fixture`)
    expect(pageAfter).toMatch(/<h1>worker \d+<\/h1>/)
    expect(pageAfter).not.toBe(pageBefore)
    expect(apiAfter).toMatch(/^after \d+$/)
    expect(isProcessAlive(Number(apiBefore.split(' ')[1]))).toBe(false)
    const unauthenticated = await fetch(`${webUrl}/__buddy/serve-ready`, { method: 'HEAD' })
    expect(unauthenticated.status).not.toBe(204)
  }
  finally {
    for (const child of children)
      child.kill('SIGTERM')
    const deadline = setTimeout(() => {
      for (const child of children)
        child.kill('SIGKILL')
    }, 2500)
    try {
      await Promise.all(children.map(child => child.exited))
      expect(runningAppSessions(root)).toEqual([])
    }
    finally {
      clearTimeout(deadline)
      await rm(root, { recursive: true, force: true })
    }
  }
}, 30_000)
