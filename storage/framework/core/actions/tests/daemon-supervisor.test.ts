import type { ProjectService } from '@stacksjs/path'
import type { DashboardLaunch, DashboardProcess, SupervisorOptions } from '../src/daemon/supervisor'
import { describe, expect, it } from 'bun:test'
import { DashboardError, DashboardSupervisor } from '../src/daemon/supervisor'

/**
 * A machine with no real processes on it: which ports are held, which answer,
 * what each project has recorded, and every dashboard the supervisor starts.
 */
function machine(overrides: Partial<SupervisorOptions> = {}) {
  const launches: DashboardLaunch[] = []
  const services = new Map<string, ProjectService>()
  const answering = new Set<number>()
  const busy = new Set<number>()
  const exits = new Map<string, (code: number) => void>()
  const signals: Array<[string, string]> = []
  let clock = 0
  let pid = 100

  const supervisor = new DashboardSupervisor({
    isProject: () => true,
    canLaunch: () => true,
    launch: (launch) => {
      launches.push(launch)
      let exit: (code: number) => void = () => {}
      const exited = new Promise<number | null>((resolve) => {
        exit = resolve
      })
      exits.set(launch.root, exit)
      const process: DashboardProcess = {
        pid: pid++,
        exited,
        kill: (signal = 'SIGTERM') => {
          signals.push([launch.root, signal])
          answering.delete(launch.port)
          exit(0)
        },
      }
      return process
    },
    readService: root => services.get(root) ?? null,
    reservePort: () => 3900,
    portIsFree: async port => !busy.has(port),
    portAnswers: async port => answering.has(port),
    logTail: () => 'Error: something in the project is broken',
    sleep: async (ms) => {
      clock += ms
      // Let whatever the test queued (an exit, a port coming up) land.
      await Promise.resolve()
    },
    now: () => clock,
    startupTimeoutMs: 1_000,
    pollMs: 100,
    ...overrides,
  })

  const service = (port: number): ProjectService => ({ name: 'dashboard', pid: 1, port, url: `http://localhost:${port}`, startedAt: '2026-01-01T00:00:00.000Z' })

  return { supervisor, launches, services, answering, busy, exits, signals, service }
}

describe('opening a project\'s dashboard', () => {
  it('uses the one that is already up, whoever started it', async () => {
    const { supervisor, launches, services, answering, service } = machine()
    // A terminal's `buddy dev:dashboard`, on the project's own port.
    services.set('/code/shop', service(3002))
    answering.add(3002)

    expect(await supervisor.open('/code/shop')).toEqual({ url: 'http://localhost:3002', port: 3002, started: false })
    expect(launches).toEqual([])
    expect(supervisor.size).toBe(0)
  })

  it('starts one with background routing, no window, and an idle limit of its own', async () => {
    const { supervisor, launches, services, answering, service } = machine({ idleExitMs: 900_000 })

    const opening = supervisor.open('/code/shop')
    services.set('/code/shop', service(3900))
    answering.add(3900)

    expect(await opening).toEqual({ url: 'http://localhost:3900', port: 3900, started: true })
    expect(launches).toEqual([{
      root: '/code/shop',
      port: 3900,
      env: { PORT_ADMIN: '3900', STACKS_NO_NATIVE: '1', STACKS_DASHBOARD_BACKGROUND: '1', STACKS_DASHBOARD_IDLE_EXIT_MS: '900000' },
    }])
    expect(supervisor.list()).toMatchObject([{ name: 'shop', path: '/code/shop', url: 'http://localhost:3900', state: 'ready' }])
  })

  it('waits for the new dashboard to publish its address even when its origin accepts connections', async () => {
    const { supervisor, services, answering, service } = machine({
      dashboardBooting: async () => {
        services.set('/code/shop', { ...service(3900), url: 'https://dashboard.shop.test' })
        return true
      },
    })
    const opened = supervisor.open('/code/shop')
    answering.add(3900)
    expect(await opened).toEqual({ url: 'https://dashboard.shop.test', port: 3900, started: true })
  })

  it('takes a framework release that records nothing as ready once its port answers', async () => {
    const { supervisor, answering } = machine()

    const opening = supervisor.open('/code/legacy')
    answering.add(3900)

    expect(await opening).toEqual({ url: 'http://localhost:3900', port: 3900, started: true })
    // And finds it again without a record to go by.
    expect(await supervisor.open('/code/legacy')).toEqual({ url: 'http://localhost:3900', port: 3900, started: false })
  })

  it('believes the port the dashboard says it bound over the one it was given', async () => {
    const { supervisor, services, service } = machine()

    const opening = supervisor.open('/code/shop')
    services.set('/code/shop', service(3907))

    expect(await opening).toEqual({ url: 'http://localhost:3907', port: 3907, started: true })
  })

  it('steps past a port another program holds', async () => {
    const { supervisor, launches, busy, answering } = machine()
    busy.add(3900).add(3901)

    const opening = supervisor.open('/code/shop')
    answering.add(3902)

    expect((await opening).port).toBe(3902)
    expect(launches[0]!.env.PORT_ADMIN).toBe('3902')
  })

  it('starts one dashboard for two requests that arrive together', async () => {
    const { supervisor, launches, answering } = machine()

    const first = supervisor.open('/code/shop')
    const second = supervisor.open('/code/shop')
    answering.add(3900)

    expect(await first).toEqual(await second)
    expect(launches).toHaveLength(1)
  })

  it('reports what the dashboard printed when it dies on the way up', async () => {
    // A project whose dashboard exits as soon as it is started.
    const { supervisor } = machine({
      launch: () => ({ pid: 1, exited: Promise.resolve(1), kill: () => {} }),
    })

    const error = await supervisor.open('/code/broken').catch(reason => reason)
    expect(error).toBeInstanceOf(DashboardError)
    expect(error.status).toBe(502)
    expect(error.message).toContain('stopped before it was ready')
    expect(error.message).toContain('something in the project is broken')
    expect(supervisor.size).toBe(0)
  })

  it('gives up on one that never comes up, and stops it', async () => {
    const { supervisor, signals } = machine()

    const error = await supervisor.open('/code/slow').catch(reason => reason)
    expect(error).toBeInstanceOf(DashboardError)
    expect(error.status).toBe(504)
    expect(signals).toEqual([['/code/slow', 'SIGTERM']])
  })

  it('does not start a second on top of one that is running but not answering', async () => {
    const { supervisor, launches, services, service } = machine()
    services.set('/code/shop', service(3002))

    const error = await supervisor.open('/code/shop').catch(reason => reason)
    expect(error.status).toBe(504)
    expect(error.message).toContain('not answering at http://localhost:3002')
    expect(launches).toEqual([])
  })

  it('refuses a directory that is not a project, and a project it cannot start', async () => {
    const notProject = machine({ isProject: () => false })
    expect((await notProject.supervisor.open('/tmp/notes').catch(reason => reason)).status).toBe(404)

    const bare = machine({ canLaunch: () => false })
    const error = await bare.supervisor.open('/code/fresh').catch(reason => reason)
    expect(error.status).toBe(409)
    expect(error.message).toContain('buddy install')
    expect(bare.launches).toEqual([])
  })
})

describe('stopping', () => {
  it('stops a dashboard it started and forgets it', async () => {
    const { supervisor, answering, signals } = machine()
    const opening = supervisor.open('/code/shop')
    answering.add(3900)
    await opening

    expect(await supervisor.stop('/code/shop')).toBe(true)
    expect(signals).toEqual([['/code/shop', 'SIGTERM']])
    expect(supervisor.size).toBe(0)
  })

  it('leaves alone a dashboard somebody started in a terminal', async () => {
    const { supervisor, services, answering, signals, service } = machine()
    services.set('/code/shop', service(3002))
    answering.add(3002)
    await supervisor.open('/code/shop')

    expect(await supervisor.stop('/code/shop')).toBe(false)
    expect(signals).toEqual([])
  })

  it('says so when a dashboard it started goes away on its own', async () => {
    let changes = 0
    const { supervisor, answering, exits } = machine({ onChange: () => changes++ })
    const opening = supervisor.open('/code/shop')
    answering.add(3900)
    await opening

    // Its own idle limit: nobody looked at it for a while.
    exits.get('/code/shop')!(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(supervisor.size).toBe(0)
    expect(changes).toBe(2)
  })
})
