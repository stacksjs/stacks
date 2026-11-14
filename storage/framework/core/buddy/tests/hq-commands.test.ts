import type { FakeHqService } from '@stacksjs/testing/hq'
import type { HqServicesConfig } from '@stacksjs/types'
import type { HqCliDeps } from '../src/hq'
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFakeHqService, fakeHqFetch } from '@stacksjs/testing/hq'
import { writeEnvEntries } from '../src/commands/hq'
import { describeReportsHqLicense, resolveHqServices, runHqConnect, runHqStatus, runSupportDoctor } from '../src/hq'
import { getCommandNames } from '../src/lazy-commands'

/**
 * `buddy hq:connect` and `buddy hq:status`, against fake services.
 *
 * The property that matters most is the one a person cannot see by running
 * the command: a key reaches `.env` and never the terminal. Every connect
 * test below checks the captured output for the keys the service issued.
 */

interface Harness {
  deps: HqCliDeps
  lines: string[]
  opened: string[]
  env: Record<string, string>
  output: () => string
}

function harness(services: FakeHqService[], overrides: Partial<HqCliDeps> = {}): Harness {
  const lines: string[] = []
  const opened: string[] = []
  const env: Record<string, string> = {}
  let clock = Date.parse('2026-01-15T12:00:00.000Z')
  return {
    lines,
    opened,
    env,
    output: () => lines.join('\n'),
    deps: {
      fetch: fakeHqFetch(...services) as HqCliDeps['fetch'],
      print: line => lines.push(line),
      open: (url) => {
        opened.push(url)
      },
      // The clock only moves when the command waits, so a timeout is exact.
      sleep: async (ms) => {
        clock += ms
      },
      now: () => clock,
      writeEnv: async (entries) => {
        Object.assign(env, entries)
      },
      ...overrides,
    },
  }
}

function configFor(...services: FakeHqService[]): HqServicesConfig {
  return Object.fromEntries(services.map(service => [service.service, { url: service.origin }]))
}

function keysOf(...services: FakeHqService[]): string[] {
  return services.flatMap(service => service.grants().flatMap(grant => [grant.ingestKey, grant.readKey]))
}

function expectNoKeyPrinted(output: string, ...services: FakeHqService[]): void {
  const keys = keysOf(...services)
  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys)
    expect(output).not.toContain(key)
}

const OPTIONS = { app: 'my-app', pollIntervalMs: 2000, timeoutMs: 60_000, readAttempts: 2 }

describe('buddy hq:connect', () => {
  it('connects each service once it is approved, writes its keys and verifies them', async () => {
    const bughq = createFakeHqService({ service: 'bughq', approveOnPoll: 1 })
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 3, confirmCode: true })
    const h = harness([bughq, loghq])

    const result = await runHqConnect(['bughq', 'loghq'], configFor(bughq, loghq), OPTIONS, h.deps)

    expect(result.ok).toBe(true)
    expect(result.outcomes.map(outcome => [outcome.service, outcome.status, outcome.send, outcome.read])).toEqual([
      ['bughq', 'connected', 'pass', 'pass'],
      ['loghq', 'connected', 'pass', 'pass'],
    ])

    const [bug] = bughq.grants()
    const [log] = loghq.grants()
    expect(bug!.project.name).toBe('my-app')
    expect(h.env).toEqual({
      BUGHQ_KEY: bug!.ingestKey,
      BUGHQ_READ_KEY: bug!.readKey,
      BUGHQ_PROJECT_ID: bug!.project.id,
      LOGHQ_KEY: log!.ingestKey,
      LOGHQ_READ_KEY: log!.readKey,
      LOGHQ_PROJECT_ID: log!.project.id,
    })

    // The person is shown where to approve, and LogHQ's confirmation code.
    expect(h.opened).toEqual([`${bughq.origin}/cli/connect?code=${bughq.codes()[0]}`, `${loghq.origin}/cli/connect?code=${loghq.codes()[0]}`])
    expect(h.output()).toContain(h.opened[1]!)
    expect(h.output()).toContain(`Confirmation code: ${loghq.confirmCodeFor(loghq.codes()[0]!)} (type it on that page)`)
    expect(h.output()).toContain('Press Ctrl+C to cancel')
    expect(h.output()).toMatch(/BugHQ\s+pass\s+pass\s+pass/)
    expect(h.output()).toMatch(/LogHQ\s+pass\s+pass\s+pass/)

    // One test record each, sent with the ingest key and found with the read key.
    expect(bughq.issues()).toHaveLength(1)
    expect(loghq.logs()).toHaveLength(1)
    expect(loghq.logs()[0]!.message).toContain('buddy hq:connect test')

    expectNoKeyPrinted(h.output(), bughq, loghq)
  })

  it('connects HQ.support with server-only keys and no synthetic support traffic', async () => {
    const support = createFakeHqService({ service: 'supporthq', approveOnPoll: 1, confirmCode: true })
    const h = harness([support])
    const result = await runHqConnect(['supporthq'], configFor(support), OPTIONS, h.deps)
    const grant = support.grants()[0]!
    expect(result.ok).toBe(true)
    expect(result.outcomes[0]).toMatchObject({ send: 'skipped', read: 'pass' })
    expect(h.env).toEqual({ SUPPORTHQ_KEY: grant.ingestKey, SUPPORTHQ_READ_KEY: grant.readKey, SUPPORTHQ_PROJECT_ID: grant.project.id })
    expect(h.output()).toContain('Confirmation code:')
    expect(support.requests().filter(request => request.startsWith('POST'))).toEqual(['POST /api/cli/connect'])
    expect(support.requests()).toContain(`GET /api/v1/projects/${grant.project.id}/conversations`)
    expectNoKeyPrinted(h.output(), support)
  })

  it('--no-open prints the link without opening it, and --no-verify sends nothing', async () => {
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1 })
    const h = harness([loghq])

    const result = await runHqConnect(['loghq'], configFor(loghq), { ...OPTIONS, open: false, verify: false }, h.deps)

    expect(result.ok).toBe(true)
    expect(result.outcomes[0]).toMatchObject({ status: 'connected', send: 'skipped', read: 'skipped' })
    expect(h.opened).toEqual([])
    expect(h.output()).toContain(`${loghq.origin}/cli/connect?code=`)
    expect(loghq.logs()).toEqual([])
    expect(loghq.requests()).not.toContain('POST /logs')
    expect(h.env.LOGHQ_KEY).toBe(loghq.grants()[0]!.ingestKey)
    expectNoKeyPrinted(h.output(), loghq)
  })

  it('gives up when nobody approves in time, writes nothing for it, and still connects the next', async () => {
    const bughq = createFakeHqService({ service: 'bughq' })
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1 })
    const h = harness([bughq, loghq])

    const result = await runHqConnect(['bughq', 'loghq'], configFor(bughq, loghq), { ...OPTIONS, timeoutMs: 10_000 }, h.deps)

    expect(result.ok).toBe(false)
    expect(result.outcomes[0]).toMatchObject({ service: 'bughq', status: 'timeout' })
    expect(result.outcomes[1]).toMatchObject({ service: 'loghq', status: 'connected', read: 'pass' })
    // Ten seconds at one poll every two.
    expect(bughq.requests().filter(request => request.startsWith('GET /api/cli/connect/'))).toHaveLength(5)
    expect(Object.keys(h.env).sort()).toEqual(['LOGHQ_KEY', 'LOGHQ_PROJECT_ID', 'LOGHQ_READ_KEY'])
    expect(h.output()).toContain('BugHQ: not connected (nobody approved it in time)')
  })

  it('reports a service without the connect route as not available yet, without failing the others', async () => {
    const statushq = createFakeHqService({ service: 'statushq', contract: false })
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1 })
    const h = harness([statushq, loghq])

    const result = await runHqConnect(['statushq', 'loghq'], configFor(statushq, loghq), OPTIONS, h.deps)

    expect(result.ok).toBe(true)
    expect(result.outcomes[0]).toMatchObject({ service: 'statushq', status: 'unavailable' })
    expect(result.outcomes[1]).toMatchObject({ service: 'loghq', status: 'connected' })
    expect(h.output()).toContain('StatusHQ: not available yet')
    expect(h.output()).toMatch(/StatusHQ\s+not available yet/)
    expect(statushq.requests()).toEqual(['POST /api/cli/connect'])
  })

  it('writes a ReportsHQ licence to .env and prints none of it', async () => {
    // ReportsHQ runs inside the app, so a connect hands over a licence and
    // there is nothing to send or read back.
    const reportshq = createFakeHqService({ service: 'reportshq', approveOnPoll: 1, license: true })
    const h = harness([reportshq])

    const result = await runHqConnect(['reportshq'], configFor(reportshq), OPTIONS, h.deps)

    const [issued] = reportshq.licenses()
    expect(issued!.licenseKey).toMatch(/^rhq_lic_[0-9a-f]{32}$/)
    expect(result.ok).toBe(true)
    expect(result.outcomes[0]).toMatchObject({ service: 'reportshq', status: 'connected', project: 'my-app', send: 'skipped', read: 'skipped' })
    expect(h.env).toEqual({ REPORTSHQ_LICENSE: issued!.licenseKey })
    expect(h.output()).toContain('ReportsHQ: licensed "my-app". Licence written to .env.')
    expect(h.output()).toMatch(/ReportsHQ\s+pass\s+-\s+-/)
    expect(h.output()).not.toContain(issued!.licenseKey)
    // Only the two connect routes were ever called.
    expect(reportshq.requests().every(request => request.includes('/api/cli/connect'))).toBe(true)
  })

  it('refuses an answer of the wrong kind rather than half writing it', async () => {
    // Keys from a service that should send a licence, and a licence from one that should send keys.
    const reportshq = createFakeHqService({ service: 'reportshq', approveOnPoll: 1 })
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1, license: true })
    const h = harness([reportshq, loghq])

    const result = await runHqConnect(['reportshq', 'loghq'], configFor(reportshq, loghq), OPTIONS, h.deps)

    expect(result.ok).toBe(false)
    expect(result.outcomes.map(outcome => outcome.status)).toEqual(['failed', 'failed'])
    expect(h.env).toEqual({})
  })

  it('treats a ReportsHQ that has no connect route yet like any service that is not available', async () => {
    const reportshq = createFakeHqService({ service: 'reportshq', contract: false })
    const h = harness([reportshq])

    const result = await runHqConnect(['reportshq'], configFor(reportshq), OPTIONS, h.deps)

    expect(result.ok).toBe(true)
    expect(result.outcomes[0]).toMatchObject({ service: 'reportshq', status: 'unavailable' })
    expect(h.output()).toContain('ReportsHQ: not available yet')
    expect(h.env).toEqual({})
  })

  it('reports a service that cannot be reached and one whose code expired', async () => {
    const loghq = createFakeHqService({ service: 'loghq' })
    const h = harness([loghq], {
      // The code is consumed behind the command's back, so the next poll finds it gone.
      sleep: async () => {
        const code = loghq.codes()[0]!
        await loghq.approve(code)
        await loghq.fetch(`${loghq.origin}/api/cli/connect/${code}`)
      },
    })

    const result = await runHqConnect(['bughq', 'loghq'], { bughq: { url: 'https://down.test' }, ...configFor(loghq) }, OPTIONS, h.deps)

    expect(result.ok).toBe(false)
    expect(result.outcomes[0]).toMatchObject({ service: 'bughq', status: 'unreachable' })
    expect(result.outcomes[1]).toMatchObject({ service: 'loghq', status: 'expired' })
    expect(h.env).toEqual({})
  })

  it('stops cleanly on Ctrl+C and writes nothing for the pending service', async () => {
    const bughq = createFakeHqService({ service: 'bughq' })
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1 })
    const controller = new AbortController()
    const h = harness([bughq, loghq], { signal: controller.signal, sleep: async () => controller.abort() })

    const result = await runHqConnect(['bughq', 'loghq'], configFor(bughq, loghq), OPTIONS, h.deps)

    expect(result.ok).toBe(false)
    expect(result.outcomes.map(outcome => outcome.status)).toEqual(['cancelled', 'cancelled'])
    expect(h.env).toEqual({})
    // The second service is never asked once the person has cancelled.
    expect(loghq.requests()).toEqual([])
    expect(h.output()).toContain('Cancelled.')
  })

  it('does not count a service past its allowance as broken', async () => {
    const bughq = createFakeHqService({ service: 'bughq', approveOnPoll: 1, storeIngest: false })
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1, storeIngest: false })
    const h = harness([bughq, loghq])

    const result = await runHqConnect(['bughq', 'loghq'], configFor(bughq, loghq), OPTIONS, h.deps)

    // Both answered 2xx and kept nothing, each in its own words.
    expect(result.ok).toBe(true)
    expect(result.outcomes.map(outcome => [outcome.send, outcome.read])).toEqual([['pass', 'skipped'], ['pass', 'skipped']])
    expect(h.output()).toContain('the plan allowance is used up, so the test error was not kept')
    expect(h.output()).toContain('the plan allowance is used up, so the test log was not kept')
  })

  it('resolves a dashboard link the service spells as a path', async () => {
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1, relativeDashboardUrl: true })
    const h = harness([loghq])

    const result = await runHqConnect(['loghq'], configFor(loghq), { ...OPTIONS, verify: false }, h.deps)

    const dashboardUrl = `${loghq.origin}/projects/${loghq.grants()[0]!.project.id}`
    expect(result.outcomes[0]!.dashboardUrl).toBe(dashboardUrl)
    expect(h.output()).toContain(`Dashboard: ${dashboardUrl}`)
  })

  it('fails the read-back when the test record never shows up', async () => {
    const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1 })
    const services = fakeHqFetch(loghq)
    const h = harness([loghq], {
      // Stored, by the service's own account, and then not there to read.
      fetch: async (input, init) => new URL(input).pathname.endsWith('/logs') && init?.method !== 'POST'
        ? Response.json({ logs: [], nextCursor: null })
        : services(input, init),
    })

    const result = await runHqConnect(['loghq'], configFor(loghq), OPTIONS, h.deps)

    expect(result.ok).toBe(false)
    expect(result.outcomes[0]).toMatchObject({ status: 'connected', send: 'pass', read: 'fail' })
    expect(h.output()).toMatch(/LogHQ\s+pass\s+pass\s+fail\s+the test log was accepted but did not show up/)
    // The keys are good even though the check failed, so they are kept.
    expect(h.env.LOGHQ_KEY).toBe(loghq.grants()[0]!.ingestKey)
    expectNoKeyPrinted(h.output(), loghq)
  })

  it('names the services it knows when asked for one it does not', () => {
    expect(resolveHqServices([])).toEqual({ services: ['bughq', 'loghq'] })
    expect(resolveHqServices(['LogHQ', 'loghq'])).toEqual({ services: ['loghq'] })
    expect(resolveHqServices(['sentry'])).toEqual({ error: 'Unknown service: sentry. Choose from bughq, loghq, analyticshq, statushq, supporthq, commshq, reportshq.' })
  })

  describe('writing .env', () => {
    let directory = ''
    afterEach(() => {
      if (directory)
        rmSync(directory, { recursive: true, force: true })
    })

    it('puts the keys in the app\'s .env, keeps what was there, and prints none of them', async () => {
      directory = mkdtempSync(join(tmpdir(), 'hq-connect-'))
      writeFileSync(join(directory, '.env'), 'APP_NAME=my-app\nLOGHQ_KEY=old\n')
      const loghq = createFakeHqService({ service: 'loghq', approveOnPoll: 1 })
      const h = harness([loghq], { writeEnv: entries => writeEnvEntries(entries, directory) })

      // Anything the writer itself might print lands here too.
      const printed: string[] = []
      const original = { log: console.log, info: console.info, error: console.error }
      console.log = console.info = console.error = (...args: unknown[]) => void printed.push(args.join(' '))
      let result
      try {
        result = await runHqConnect(['loghq'], configFor(loghq), OPTIONS, h.deps)
      }
      finally {
        Object.assign(console, original)
      }

      expect(result.ok).toBe(true)
      const grant = loghq.grants()[0]!
      const file = readFileSync(join(directory, '.env'), 'utf8')
      expect(file).toContain('APP_NAME=my-app')
      expect(file).toContain(`LOGHQ_KEY="${grant.ingestKey}"`)
      expect(file).toContain(`LOGHQ_READ_KEY="${grant.readKey}"`)
      expect(file).toContain(`LOGHQ_PROJECT_ID="${grant.project.id}"`)
      expect(file).not.toContain('LOGHQ_KEY=old')
      // A plain file stays plain: no keypair is started for it.
      expect(file).not.toContain('DOTENV_PUBLIC_KEY')
      expectNoKeyPrinted([...h.lines, ...printed].join('\n'), loghq)
    })

    it('creates .env when the app has none', async () => {
      directory = mkdtempSync(join(tmpdir(), 'hq-connect-'))
      await writeEnvEntries({ BUGHQ_KEY: 'value-one' }, directory)
      expect(readFileSync(join(directory, '.env'), 'utf8')).toContain('BUGHQ_KEY="value-one"')
    })
  })
})

describe('buddy hq:status', () => {
  function connected(service: FakeHqService): HqServicesConfig[keyof HqServicesConfig] {
    const grant = service.project('my-app')
    return { url: service.origin, readKey: grant.readKey, project: grant.project.id }
  }

  it('prints used, limit, period and state, with the upgrade link from 80 percent', async () => {
    const bughq = createFakeHqService({ service: 'bughq', meters: [{ meter: 'errors', used: 400, limit: 500 }] })
    const loghq = createFakeHqService({ service: 'loghq', meters: [{ meter: 'logs', used: 1200, limit: 10_000 }] })
    const h = harness([bughq, loghq])

    const rows = await runHqStatus({ bughq: connected(bughq), loghq: connected(loghq) }, h.deps)

    expect(rows).toEqual([
      { service: 'bughq', meter: 'errors', used: 400, limit: 500, period: expect.stringMatching(/^\d{4}-\d{2}$/), state: 'warn', upgradeUrl: `${bughq.origin}/pricing` },
      { service: 'loghq', meter: 'logs', used: 1200, limit: 10_000, period: expect.stringMatching(/^\d{4}-\d{2}$/), state: 'ok' },
    ])
    expect(h.output()).toMatch(/BugHQ\s+errors\s+400\s+500\s+\d{4}-\d{2}\s+warn/)
    expect(h.output()).toMatch(/LogHQ\s+logs\s+1,200\s+10,000\s+\d{4}-\d{2}\s+ok/)
    expect(h.output()).toContain(`BugHQ errors is at 80% of its allowance. Upgrade: ${bughq.origin}/pricing`)
    expect(h.output()).not.toContain(`${loghq.origin}/pricing`)
    expectNoKeyPrinted(h.output(), bughq, loghq)
  })

  it('shows an unlimited meter and stays quiet about upgrading just under 80 percent', async () => {
    const bughq = createFakeHqService({ service: 'bughq', meters: [{ meter: 'errors', used: 399, limit: 500 }, { meter: 'sessions', used: 7, limit: null }] })
    const h = harness([bughq])

    await runHqStatus({ bughq: connected(bughq) }, h.deps)

    expect(h.output()).toMatch(/BugHQ\s+sessions\s+7\s+unlimited/)
    expect(h.output()).not.toContain('Upgrade')
  })

  it('says why a connected service has no usage to show', async () => {
    const bughq = createFakeHqService({ service: 'bughq' })
    const statushq = createFakeHqService({ service: 'statushq', contract: false })
    const h = harness([bughq, statushq])

    const rows = await runHqStatus({
      bughq: { url: bughq.origin, readKey: 'not-a-key' },
      statushq: { url: statushq.origin, readKey: 'anything' },
      loghq: { url: 'https://down.test', readKey: 'anything' },
    }, h.deps)

    expect(rows).toEqual([
      { service: 'bughq', unavailable: 'the read key was refused' },
      { service: 'loghq', unavailable: 'the service could not be reached' },
      { service: 'statushq', unavailable: 'not available yet' },
    ])
    expect(h.output()).toMatch(/StatusHQ\s+not available yet/)
  })

  it('reports a ReportsHQ licence offline, without a request and without showing the key', async () => {
    // ReportsHQ runs inside the app. It has no keys to read usage with and
    // meters nothing, so its line comes from config alone.
    const license = `rhq_lic_${'0123456789abcdef'.repeat(2)}`
    const h = harness([])

    const rows = await runHqStatus({ reportshq: { url: 'https://down.test', license } }, h.deps)

    expect(rows).toEqual([{ service: 'reportshq', unavailable: 'licensed (checked offline, nothing is metered)' }])
    expect(h.output()).toMatch(/ReportsHQ\s+licensed \(checked offline, nothing is metered\)/)
    expect(h.output()).not.toContain(license)

    const malformed = harness([])
    await runHqStatus({ reportshq: { url: 'https://reportshq.org', license: 'pasted-the-wrong-thing' } }, malformed.deps)
    expect(malformed.output()).toContain('the licence key is not in the expected format')
    expect(malformed.output()).not.toContain('pasted-the-wrong-thing')

    expect(describeReportsHqLicense(undefined)).toContain('unlicensed. Reports work in full')
  })

  it('tells an app with nothing connected how to connect', async () => {
    const h = harness([])
    expect(await runHqStatus({ loghq: { url: 'https://loghq.org' } }, h.deps)).toEqual([])
    expect(h.output()).toContain('Run `buddy hq:connect`')
  })
})

describe('registration', () => {
  it('lists HQ and support commands', () => {
    expect(getCommandNames()).toEqual(expect.arrayContaining(['hq:connect', 'hq:status', 'support:install', 'support:doctor']))
  })
})

describe('buddy support:doctor', () => {
  it('checks usage and summaries with read credentials and sends nothing', async () => {
    const support = createFakeHqService({ service: 'supporthq', meters: [{ meter: 'conversations', used: 80, limit: 100 }, { meter: 'ai_conversations', used: 10, limit: 10 }] })
    const grant = support.project()
    const h = harness([support])
    const config = { supporthq: { url: support.origin, key: grant.ingestKey, readKey: grant.readKey, project: grant.project.id } }
    const result = await runSupportDoctor(config, h.deps)
    expect(result.ok).toBe(true)
    expect(result.checks.map(check => check.name)).toEqual(['configuration', 'usage', 'conversations'])
    expect(support.requests()).toEqual(['GET /api/v1/usage', `GET /api/v1/projects/${grant.project.id}/conversations`])
    expectNoKeyPrinted(h.output(), support)
    const rows = await runHqStatus(config, h.deps)
    expect(rows.map(item => item.meter)).toEqual(['conversations', 'ai_conversations'])
  })

  it('reports missing config and refused read keys without exposing secrets', async () => {
    const h = harness([])
    expect((await runSupportDoctor({}, h.deps)).ok).toBe(false)
    const support = createFakeHqService({ service: 'supporthq' })
    const refused = harness([support])
    const result = await runSupportDoctor({ supporthq: { url: support.origin, key: 'secret', readKey: 'invalid', project: 'p' } }, refused.deps)
    expect(result.ok).toBe(false)
    expect(refused.output()).not.toContain('secret')
    expect(refused.output()).not.toContain('invalid')
    expect(refused.output()).toContain('the read key was refused')
  })
})

it('native support doctor checks the approved origin and immutable widget without creating customer traffic', async () => {
  const service = createFakeHqService({ service: 'supporthq' }), grant = service.project()
  const h = harness([service]), original = h.deps.fetch, requests: string[] = []
  h.deps.fetch = async (input, init) => {
    if (input.endsWith('/installation')) {
      requests.push(String(init?.method ?? 'GET'))
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${grant.ingestKey}`)
      return Response.json({ service: 'supporthq', protocol: 1, project: grant.project.id, buddyConnected: true, allowedOrigins: ['https://app.example'] })
    }
    if (input.endsWith('/widgets/manifest.json')) {
      requests.push(String(init?.method ?? 'GET'))
      expect(new Headers(init?.headers).has('authorization')).toBe(false)
      return Response.json({ schemaVersion: 1, files: [{ path: '/widgets/1-hash/bundle.js', sha256: 'a'.repeat(64), gzipBytes: 9000 }] })
    }
    return await original(input, init)
  }
  const config = { supporthq: { url: service.origin, key: grant.ingestKey, readKey: grant.readKey, project: grant.project.id, enabled: true, messenger: { enabled: true, loaderUrl: `${service.origin}/support.js` } } }
  expect((await runSupportDoctor(config, h.deps, { origin: 'https://app.example' })).ok).toBe(true)
  expect(requests).toEqual(['GET', 'GET'])
  expect((await runSupportDoctor(config, h.deps, { origin: 'https://unapproved.example' })).ok).toBe(false)
  expectNoKeyPrinted(h.output(), service)
})
