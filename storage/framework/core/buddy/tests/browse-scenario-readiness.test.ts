import { expect, spyOn, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { runInNewContext } from 'node:vm'
import { parseScenarioStep, runScenarioStep } from '../../../defaults/ai/skills/stacks-browse/scripts/browse'

test('a disconnected real scenario retains its completed steps and failed observation phases', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'browse-disconnect-report-'))
  let browserPid = 0, disconnected = false
  const phases: string[] = ['launch']
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(request) {
      phases.push(`request:${new URL(request.url).pathname}`)
      if (new URL(request.url).pathname === '/disconnect') {
        phases.push('disconnect-requested')
        // Only this child's uniquely owned profile and this fixture's page
        // qualify. Never enumerate or close a user's browser session.
        const profile = readdirSync(tmpdir()).find(name => name.startsWith(`stacks-browse-${browserPid}-`))
        if (!profile) throw new Error('The scenario did not own a browser profile')
        const port = Number(readFileSync(join(tmpdir(), profile, 'DevToolsActivePort'), 'utf8').split('\n')[0])
        phases.push('target-list')
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as { id: string, url: string }[]
        const page = pages.find(page => page.url === server.url.href)
        if (!page) throw new Error('The owned fixture page was not found')
        phases.push('target-close')
        const closed = await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(page.id)}`)
        if (!closed.ok) throw new Error('Chrome did not close the owned target')
        disconnected = true
        return new Response('Closed the owned target')
      }
      return new Response('<h1>Before disconnect</h1>', { headers: { 'content-type': 'text/html' } })
    },
  })
  const driver = resolve(import.meta.dir, '../../../defaults/ai/skills/stacks-browse/scripts/browse.ts')
  const capture = join(directory, 'capture.png')
  // Trace discovery in this child only. Keep the real executables, arguments
  // and results so a stuck system browser identifies its boundary on CI.
  const trace = join(directory, 'discovery-trace.ts')
  writeFileSync(trace, `const original = Bun.spawnSync
Bun.spawnSync = function (...args) {
  console.error('Browser discovery start:', JSON.stringify(args[0]))
  const result = original.apply(Bun, args)
  console.error('Browser discovery end:', result.exitCode)
  return result
}
`)
  // This dependency-free public CLI runs in a new process group and a fresh
  // directory, with no application runtime or user state substituted. Its
  // existing startup, CDP and load bounds total 40s before scenario execution.
  const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', trace, driver, 'scenario', server.url.href,
    '--out', capture,
    '--step', JSON.stringify({ action: 'assert', selector: 'h1', text: 'Before disconnect' }),
    '--step', JSON.stringify({ action: 'evaluate', expression: `fetch(${JSON.stringify(new URL('/disconnect', server.url).href)}).then(response => response.text())` }),
  ], { cwd: directory, detached: true, stdout: 'pipe', stderr: 'pipe', timeout: 45_000 })
  browserPid = child.pid
  try {
    const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (!disconnected) throw new Error(`The fixture did not close its owned target: ${JSON.stringify({ phases, code, output, error })}`)
    expect(code).toBe(1)
    const report = JSON.parse(output)
    expect(report.steps).toHaveLength(2)
    expect(report.steps[0]).toMatchObject({ action: 'assert', ok: true, text: 'Before disconnect' })
    expect(report.steps[1]).toMatchObject({ action: 'evaluate', ok: false, step: 2 })
    expect(report.final).toBeNull()
    expect(report.screenshot).toBeNull()
    expect(report.collectionErrors.map((error: { phase: string }) => error.phase)).toEqual(['final-state', 'screenshot'])
    expect(await Bun.file(capture).exists()).toBe(false)
  }
  finally {
    if (child.exitCode === null) {
      try { process.kill(-child.pid, 'SIGTERM') }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
    }
    server.stop(true)
    rmSync(directory, { recursive: true, force: true })
  }
}, 50_000)

test('keyboard scenarios send physical digit and letter codes on both events', async () => {
  for (const [key, code, virtual] of [['1', 'Digit1', 49], ['9', 'Digit9', 57], ['h', 'KeyH', 72], ['S', 'KeyS', 83], [' ', 'Space', 32]]) {
    const events: Record<string, unknown>[] = []
    const browser = { send: async (method: string, params: Record<string, unknown> = {}) => {
      expect(method).toBe('Input.dispatchKeyEvent')
      events.push(params)
      return {}
    } }
    await runScenarioStep(browser, parseScenarioStep(JSON.stringify({ action: 'press', key })))
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'keyDown', key, code, windowsVirtualKeyCode: virtual })
    expect(events[1]).toMatchObject({ type: 'keyUp', key, code, windowsVirtualKeyCode: virtual })
  }
})

function page(delayMs: number) {
  const started = performance.now()
  const element = {
    tagName: 'BUTTON',
    get innerText() { return performance.now() - started >= delayMs ? 'Sound on' : 'Sound off' },
    getBoundingClientRect: () => ({ width: 100, height: 30 }),
  }
  let probes = 0
  return {
    probes: () => probes,
    send: async (method: string, params: Record<string, unknown> = {}) => {
      expect(method).toBe('Runtime.evaluate')
      probes++
      const value = runInNewContext(String(params.expression), {
        document: { querySelectorAll: () => [element] },
        getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
      })
      return { result: { value } }
    },
  }
}

test('bounded assertions observe asynchronous visible state instead of a fixed sleep', async () => {
  let now = 0
  const clock = spyOn(performance, 'now').mockImplementation(() => now)
  try {
    const browser = page(80), send = browser.send
    browser.send = async (...args) => { now += 40; return send(...args) }
    const step = parseScenarioStep(JSON.stringify({ action: 'assert', selector: 'button', text: 'Sound on', timeoutMs: 1000 }))
    expect(await runScenarioStep(browser, step)).toMatchObject({ ok: true, text: 'Sound on' })
    expect(browser.probes()).toBe(2)
  }
  finally { clock.mockRestore() }
})

test('bounded assertions retain failure when the visible result never arrives', async () => {
  // Advance the deadline at the CDP boundary. A loaded event loop may spend
  // the whole real 80ms budget on one probe, so wall time cannot count retries.
  let now = 0
  const clock = spyOn(performance, 'now').mockImplementation(() => now)
  try {
    const browser = page(Infinity), send = browser.send
    browser.send = async (...args) => { const result = await send(...args); now += 40; return result }
    const step = parseScenarioStep(JSON.stringify({ action: 'assert', selector: 'button', text: 'Sound on', timeoutMs: 80 }))
    await expect(runScenarioStep(browser, step)).rejects.toThrow('Scenario assert failed: Element not found (button)')
    expect(browser.probes()).toBe(2)
  }
  finally { clock.mockRestore() }
})

test('ordinary assertions remain immediate and protocol errors are not retried', async () => {
  const browser = page(Infinity)
  await expect(runScenarioStep(browser, parseScenarioStep('{"action":"assert","selector":"button","text":"Sound on"}'))).rejects.toThrow('Element not found')
  expect(browser.probes()).toBe(1)
  let calls = 0
  const broken = { send: async () => { calls++; throw new Error('CDP connection closed') } }
  await expect(runScenarioStep(broken, parseScenarioStep('{"action":"assert","selector":"button","timeoutMs":1000}'))).rejects.toThrow('CDP connection closed')
  expect(calls).toBe(1)
})

test('readiness budgets are bounded and apply only to assertions', () => {
  for (const timeoutMs of [-1, 0.5, 30001, '1000']) {
    expect(() => parseScenarioStep(JSON.stringify({ action: 'assert', selector: 'button', timeoutMs }))).toThrow('timeoutMs')
  }
  expect(() => parseScenarioStep('{"action":"click","selector":"button","timeoutMs":1000}')).toThrow('timeoutMs')
})

test('the assertion deadline also bounds a stalled browser response', async () => {
  const stalled = { send: async () => await new Promise<never>(() => {}) }
  await expect(runScenarioStep(stalled, parseScenarioStep('{"action":"assert","selector":"button","timeoutMs":40}'))).rejects.toThrow('timed out after 40ms')
})

test('a successful response after the deadline cannot pass the assertion', async () => {
  const late = { send: async () => {
    const until = performance.now() + 50
    while (performance.now() < until) { /* An occupied event loop delays timers too. */ }
    return { result: { value: { ok: true } } }
  } }
  await expect(runScenarioStep(late, parseScenarioStep('{"action":"assert","selector":"button","timeoutMs":20}'))).rejects.toThrow('timed out after 20ms')
})
