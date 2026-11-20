import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { isProcessAlive, registerProject } from '@stacksjs/path'
import { daemonStatus, openProjectDashboard, readDaemonState, startDaemon, stopDaemon } from '../src/daemon/client'
import { machineEnvironment } from '../src/daemon/environment'
import { DAEMON_PROTOCOL, daemonSocket, daemonStateFile } from '../src/daemon/paths'

/**
 * The real daemon, started the way anything starts it, in a home of its own.
 *
 * `/tmp` and not the system temp directory: a unix socket's path is capped at
 * about a hundred bytes, and macOS's temp directory alone is half of that.
 */
let home: string
const previous = { home: process.env.STACKS_HOME, idle: process.env.STACKS_DAEMON_IDLE_EXIT_MS }

beforeEach(() => {
  home = mkdtempSync('/tmp/stacks-daemon-')
  process.env.STACKS_HOME = home
})

afterEach(async () => {
  await stopDaemon()
  for (const [name, value] of [['STACKS_HOME', previous.home], ['STACKS_DAEMON_IDLE_EXIT_MS', previous.idle]] as const) {
    if (value === undefined)
      delete process.env[name]
    else
      process.env[name] = value
  }
  rmSync(home, { recursive: true, force: true })
})

async function until(condition: () => boolean, ms = 10_000): Promise<boolean> {
  const deadline = Date.now() + ms
  while (!condition() && Date.now() < deadline)
    await Bun.sleep(25)
  return condition()
}

describe('the background daemon', () => {
  it('starts on demand, once, and answers on a socket only its owner can open', async () => {
    expect(await daemonStatus()).toBeNull()

    const first = await startDaemon()
    expect(first.started).toBe(true)
    expect(first.status).toMatchObject({ protocol: DAEMON_PROTOCOL, dashboards: [] })
    expect(isProcessAlive(first.status.pid)).toBe(true)
    expect(first.status.pid).not.toBe(process.pid)

    // Owner read and write, nobody else anything.
    expect(statSync(daemonSocket()).mode & 0o777).toBe(0o600)

    const second = await startDaemon()
    expect(second.started).toBe(false)
    expect(second.status.pid).toBe(first.status.pid)
  }, 30_000)

  it('stops when asked and leaves nothing behind', async () => {
    const { status } = await startDaemon()

    expect(await stopDaemon()).toBe(true)
    expect(await until(() => !isProcessAlive(status.pid))).toBe(true)
    expect(existsSync(daemonStateFile())).toBe(false)
    expect(existsSync(daemonSocket())).toBe(false)
    expect(readDaemonState()).toBeNull()
    expect(await stopDaemon()).toBe(false)
  }, 30_000)

  it('stops itself once it has nothing to look after', async () => {
    process.env.STACKS_DAEMON_IDLE_EXIT_MS = '300'
    const { status } = await startDaemon()

    expect(await until(() => !isProcessAlive(status.pid))).toBe(true)
    expect(existsSync(daemonStateFile())).toBe(false)
  }, 30_000)

  it('refuses to start a dashboard for a directory that is not a project', async () => {
    const error = await openProjectDashboard(join(home, 'not-a-project')).catch(reason => reason)

    expect(error.name).toBe('DaemonError')
    expect(error.status).toBe(404)
    expect(error.message).toContain('is not a Stacks project')
    // Asking was enough to bring the daemon up.
    expect(await daemonStatus()).not.toBeNull()
  }, 30_000)

  it('watches newly registered projects with their own runtime and batches source edits', async () => {
    const audit = join(home, 'generation.log')
    const makeProject = (name: string, version: string) => {
      const root = join(home, name)
      const cli = join(root, 'node_modules/@stacksjs/buddy/dist')
      for (const dir of [cli, join(root, 'config'), join(root, 'resources'), join(root, 'storage/framework/auto-imports')])
        mkdirSync(dir, { recursive: true })
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
      writeFileSync(join(root, 'config/app.ts'), 'export default {}')
      writeFileSync(join(root, 'config/buddy.json'), '{"generation":{"enabled":true}}')
      writeFileSync(join(cli, 'project-generation.js'), '')
      writeFileSync(join(cli, 'cli.js'), `
        import { appendFileSync } from 'node:fs'
        const mark = value => appendFileSync(${JSON.stringify(audit)}, value + '\\n')
        mark('start ${version} ' + process.argv.slice(2).join(' '))
        await Bun.sleep(150)
        mark('end ${version}')
      `)
      return root
    }
    const entries = () => existsSync(audit) ? readFileSync(audit, 'utf8').trim().split('\n') : []
    const first = makeProject('shop', '1')
    registerProject(first)
    const { status } = await startDaemon()
    expect(status.generation?.watched).toBe(1)

    const second = makeProject('blog', '2')
    registerProject(second)
    expect(await until(() => entries().length === 4)).toBe(true)
    expect(entries()).toEqual([
      'start 1 generate:project --tasks imports,migrations,types', 'end 1',
      'start 2 generate:project --tasks imports,migrations,types', 'end 2',
    ])

    const helpers = join(second, 'resources/functions')
    mkdirSync(helpers)
    for (let index = 0; index < 8; index++)
      writeFileSync(join(helpers, `helper-${index}.ts`), 'export const helper = 1\n')
    expect(await until(() => entries().length === 6)).toBe(true)

    const file = join(helpers, 'helper-0.ts')
    writeFileSync(`${file}.tmp`, 'export const renamed = 1\n')
    renameSync(`${file}.tmp`, file)
    expect(await until(() => entries().length === 8)).toBe(true)
    expect(entries().slice(-2)).toEqual(['start 2 generate:project --tasks imports', 'end 2'])
    expect((await daemonStatus())?.generation).toMatchObject({ watched: 2, queued: 0, failures: [] })

    writeFileSync(join(second, 'storage/framework/auto-imports/functions.ts'), 'export {}')
    await Bun.sleep(1_100)
    expect(entries()).toHaveLength(8)
  }, 20_000)
})

describe('the environment the daemon keeps', () => {
  it('carries the machine and the person, and nothing of the project that started it', () => {
    const kept = machineEnvironment({
      HOME: '/Users/dev',
      USER: 'dev',
      LANG: 'en_US.UTF-8',
      STACKS_HOME: '/Users/dev/.stacks',
      PATH: '/Users/dev/Code/shop/pantry/.bin:/Users/dev/Code/shop/node_modules/.bin/:/Users/dev/.bun/bin:/usr/bin',
      // What a project's `.env` put in the process that started the daemon.
      APP_KEY: 'base64:secret',
      DB_DATABASE: 'shop',
      PORT_ADMIN: '3002',
      NODE_PATH: '/Users/dev/Code/shop/node_modules',
      STACKS_BUDDY_ROOT: '/Users/dev/Code/shop',
    })

    expect(kept).toEqual({
      HOME: '/Users/dev',
      USER: 'dev',
      LANG: 'en_US.UTF-8',
      STACKS_HOME: '/Users/dev/.stacks',
      PATH: '/Users/dev/.bun/bin:/usr/bin',
    })
  })
})
