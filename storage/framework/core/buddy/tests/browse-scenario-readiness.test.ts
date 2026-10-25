import { expect, spyOn, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { runInNewContext } from 'node:vm'
import { parseScenarioStep, runScenarioStep } from '../../../defaults/ai/skills/stacks-browse/scripts/browse'

function fixtureBrowser(): string {
  const browser = process.env.BROWSE_BROWSER
    ?? Bun.which('google-chrome-stable') ?? Bun.which('google-chrome')
    ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe')].find(path => existsSync(path))
  if (!browser || !existsSync(browser)) throw new Error('The real scenario fixture requires Chrome or an explicit BROWSE_BROWSER path.')
  return browser
}

test('a disconnected real scenario retains its completed steps and failed observation phases', async () => {
  // This fixture tests a real target disconnection, not browser discovery.
  // Linux CI's chromium launchers each consumed a full 15s fallback bound
  // before Chrome started. Select the host explicitly through the public CLI
  // option instead of timing unrelated candidate fallbacks inside this test.
  const browser = fixtureBrowser()
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
  // This dependency-free public CLI runs in a new process group and a fresh
  // directory, with no application runtime or user state substituted. Its
  // selected host has separate startup, CDP and page-load bounds.
  const child = Bun.spawn([process.execPath, '--no-env-file', driver, 'scenario', server.url.href,
    '--out', capture,
    '--step', JSON.stringify({ action: 'assert', selector: 'h1', text: 'Before disconnect' }),
    '--step', JSON.stringify({ action: 'evaluate', expression: `fetch(${JSON.stringify(new URL('/disconnect', server.url).href)}).then(response => response.text())` }),
  ], { cwd: directory, env: { ...process.env, BROWSE_BROWSER: browser }, detached: true, stdout: 'pipe', stderr: 'pipe', timeout: 45_000 })
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

test('default discovery chooses installed Chrome before a Chromium launcher that cannot start', async () => {
  const browser = fixtureBrowser(), directory = mkdtempSync(join(tmpdir(), 'browse-default-host-'))
  const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`
  const attempted = join(directory, 'chromium-attempted'), launched = join(directory, 'chrome-launched')
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('<h1>Actual Chrome</h1>', { headers: { 'content-type': 'text/html' } }) })
  try {
    // Match the CI failure: the Chromium launcher answers --version but cannot
    // expose a browser target. The Chrome launcher executes the actual host.
    writeFileSync(join(directory, 'chromium'), `#!/bin/sh
printf attempted > ${quote(attempted)}
if [ "$1" = "--version" ]; then printf 'Chromium fixture\n'; exit 0; fi
exit 1
`, { mode: 0o755 })
    writeFileSync(join(directory, 'google-chrome-stable'), `#!/bin/sh
printf launched > ${quote(launched)}
exec ${quote(browser)} "$@"
`, { mode: 0o755 })
    const driver = resolve(import.meta.dir, '../../../defaults/ai/skills/stacks-browse/scripts/browse.ts')
    const child = Bun.spawn([process.execPath, '--no-env-file', driver, 'scenario', server.url.href,
      '--step', JSON.stringify({ action: 'assert', selector: 'h1', text: 'Actual Chrome' }),
    ], { cwd: directory, env: { ...process.env, PATH: `${directory}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`, BROWSE_BROWSER: '' }, stdout: 'pipe', stderr: 'pipe', timeout: 45_000 })
    const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, error).toBe(0)
    expect(existsSync(launched)).toBe(true)
    expect(existsSync(attempted), 'A usable Chrome host must precede the unlaunchable Chromium candidate').toBe(false)
    const report = JSON.parse(output)
    expect(report.steps).toEqual([{ action: 'assert', selector: 'h1', tag: 'h1', text: 'Actual Chrome', ok: true }])
    expect(report.consoleErrors).toEqual([])
    expect(report.failedRequests).toEqual([])
  }
  finally { server.stop(true); rmSync(directory, { recursive: true, force: true }) }
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
