import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const skill = readFileSync(
  resolve('storage/framework/defaults/ai/skills/stacks-browse/SKILL.md'),
  'utf8',
)
const script = readFileSync(
  resolve('storage/framework/defaults/ai/skills/stacks-browse/scripts/browse.ts'),
  'utf8',
)

describe('browse skill contract', () => {
  test('documents a dependency-free whole-site browser audit', () => {
    expect(skill).toContain('### Crawl (whole-site browser audit)')
    expect(skill).toContain('browse.ts crawl <url> [--viewport 1280x900] [--max 500] [--path /extra-route] [--settle 350] [--progress] [--summary]')
    expect(skill).toContain('following every same-origin link it discovers')
    expect(skill).toContain('Repeat `--path` to seed routes that are not')
    expect(skill).toContain('exits\nnonzero when any page fails')
    expect(skill).toContain('compact failure\ndiagnostics')
  })

  test('checks every crawled page for runtime and layout failures', () => {
    expect(script).toContain("else if (command === 'crawl')")
    expect(script).toContain('page.status !== 200')
    expect(script).toContain('page.consoleErrors.length > 0')
    expect(script).toContain('page.failedRequests.length > 0')
    expect(script).toContain('page.horizontalOverflowPx > 0')
    expect(script).toContain('Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - ${crawlViewport.w}')
    expect(script).toContain('viewport: crawlViewport')
    expect(script).toContain('overflowingElements: value.overflowing || []')
    expect(script).toContain("['auto', 'scroll', 'hidden', 'clip'].includes(overflowX)")
    expect(script).toContain('scrollWidth: ancestor.scrollWidth')
    expect(script).toContain('if (failures.length > 0)')
    expect(script).toContain('process.exitCode = 1')
    expect(script).toContain('if (flags.progress)')
    expect(script).toContain('const summaryOnly = Boolean(flags.summary)')
    expect(script).toContain('failureCount: failures.length')
    expect(script).toContain('consoleErrorCount: page.consoleErrors.length')
    expect(script).toContain('failedRequestCount: page.failedRequests.length')
    expect(script).toContain('...(!summaryOnly ? { paths: pages.map(page => page.path) } : {})')
    expect(script).toContain('console.error(`[crawl]')
    expect(script).toContain('dispose: () => unsubscribe()')
    expect(script).toContain('state.dispose()')
  })

  test('detects overflow when mobile Chrome expands innerWidth to fit the page', () => {
    const responsive = script.slice(script.indexOf("else if (command === 'responsive')"), script.indexOf("else if (command === 'monitor')"))
    const expression = responsive.match(/expression: [`']([^`']+)[`']/)?.[1]
    expect(expression).toBeDefined()
    const measure = new Function('document', 'window', `return (${expression!.replaceAll('${bp.w}', '320')})`)
    expect(measure({ body: { scrollWidth: 563 }, documentElement: { scrollWidth: 563 } }, { innerWidth: 563 })).toBe(243)
    expect(measure({ body: { scrollWidth: 320 }, documentElement: { scrollWidth: 320 } }, { innerWidth: 320 })).toBe(0)
    expect(measure({ body: { scrollWidth: 300 }, documentElement: { scrollWidth: 320 } }, { innerWidth: 320 })).toBe(0)
  })

  test('documents repeatable stateful SPA scenarios', () => {
    expect(skill).toContain('### Scenario (stateful SPA interactions)')
    expect(skill).toContain('Supported actions are `click`, `fill`, `focus`, `press`, `wait`, `evaluate`, and `assert`')
    expect(skill).toContain('inspecting STX signals and DevTools state')
    expect(skill).toContain('scroll matched controls into view')
    expect(skill).toContain('"absent":true')
    expect(skill).toContain('"focused":true')
    expect(skill).toContain('preserving reactive STX state and SPA navigation')
    expect(script).toContain("else if (command === 'scenario')")
    expect(script).toContain('flagList(flags.step).map(parseScenarioStep)')
    expect(script).toContain("element.dispatchEvent(new InputEvent('input'")
    expect(script).toContain("step.action === 'click' || step.action === 'focus'")
    expect(script).toContain("if (typeof element.focus !== 'function')")
    expect(script).toContain('element.focus()')
    expect(script).toContain("await cdp.send('Input.dispatchMouseEvent'")
    expect(script).toContain("await cdp.send('Page.bringToFront')")
    expect(script).toContain("error: 'Element did not receive focus'")
    expect(script).toContain("step.action === 'assert' && step.absent")
    expect(script).toContain("error: 'Expected element to be absent'")
    expect(script).toContain("error: step.focused ? 'Expected element to be focused'")
    expect(script).toContain("await cdp.send('Input.dispatchKeyEvent'")
    expect(script).toContain("element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })")
    expect(script).toContain("error: 'Element could not be scrolled into the viewport'")
    expect(script).toContain("step.action === 'evaluate'")
    expect(script).toContain('awaitPromise: true')
    expect(script).toContain('result.exceptionDetails')
    expect(script).toContain("role: document.activeElement.getAttribute?.('role') || null")
    expect(script).toContain("ref: document.activeElement.getAttribute?.('data-stx-ref') || null")
    expect(script).toContain("window.__browseFocusHistory.push({ event: 'focusout'")
    expect(script).toContain('focusHistory: window.__browseFocusHistory || []')
    expect(script).toContain('consoleMessages: state.console')
    expect(script).toContain('state.consoleErrors.length || failedRequests.length')
    expect(script).toContain('step: results.length + 1')
    expect(skill).toContain('`collectionErrors`')
    expect(skill).toContain('sets the missing result to')
    expect(skill).toContain('exits nonzero')
  })

  test('keeps crawling within the starting origin', () => {
    expect(script).toContain('url.origin !== origin')
    expect(script).toContain("!['http:', 'https:'].includes(url.protocol)")
    expect(script).toContain('url.hash = \'\'')
  })

  test('delivers Enter text for native button activation without typing during navigation', async () => {
    const block = script.slice(script.indexOf("  if (step.action === 'press')"), script.indexOf("  if (step.action === 'evaluate')"))
    const press = new Function('cdp', 'step', `return (async () => { ${block} })()`)
    const events: Array<{ type: string, key: string, text?: string }> = []
    const cdp = { send: async (method: string, event: { type: string, key: string, text?: string }) => { expect(method).toBe('Input.dispatchKeyEvent'); events.push(event) } }
    await press(cdp, { action: 'press', key: 'Enter' })
    expect(events[0]).toMatchObject({ type: 'keyDown', key: 'Enter', text: '\r' })
    expect(events[1]).toMatchObject({ type: 'keyUp', key: 'Enter' })
    expect(events[1]?.text).toBeUndefined()
    for (const key of ['Tab', 'ArrowDown']) {
      events.length = 0
      await press(cdp, { action: 'press', key })
      expect(events[0]?.text).toBeUndefined()
      expect(events[1]?.text).toBeUndefined()
    }
  })

  test('delivers native virtual key codes for browser navigation and editing', async () => {
    const block = script.slice(script.indexOf("  if (step.action === 'press')"), script.indexOf("  if (step.action === 'evaluate')"))
    const press = new Function('cdp', 'step', `return (async () => { ${block} })()`)
    for (const [key, keyCode] of [['ArrowLeft', 37], ['ArrowUp', 38], ['ArrowRight', 39], ['ArrowDown', 40], ['Home', 36], ['End', 35], ['PageUp', 33], ['PageDown', 34], ['Backspace', 8], ['Delete', 46], ['Insert', 45]] as const) {
      const events: Record<string, unknown>[] = []
      await press({ send: async (method: string, event: Record<string, unknown>) => { expect(method).toBe('Input.dispatchKeyEvent'); events.push(event) } }, { action: 'press', key })
      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({ type: 'keyDown', key, code: key, windowsVirtualKeyCode: keyCode })
      expect(events[1]).toMatchObject({ type: 'keyUp', key, code: key, windowsVirtualKeyCode: keyCode })
      expect(events[0]?.text).toBeUndefined()
      expect(events[1]?.text).toBeUndefined()
    }
  })

  test('rejects an unsupported named key before dispatching a false successful press', async () => {
    const block = script.slice(script.indexOf("  if (step.action === 'press')"), script.indexOf("  if (step.action === 'evaluate')"))
    const press = new Function('cdp', 'step', `return (async () => { ${block} })()`)
    const events: unknown[] = []
    await expect(press({ send: async (...event: unknown[]) => { events.push(event) } }, { action: 'press', key: 'ArrowDwon' })).rejects.toThrow('Unsupported scenario key')
    expect(events).toEqual([])
  })

  test('uses isolated page targets and relaunches a failed browser session', () => {
    const crawl = script.slice(script.indexOf("else if (command === 'crawl')"))
    const connection = crawl.indexOf('let browserPage = await createPage(session.port)')
    const loop = crawl.indexOf('while (queue.length > 0')

    expect(connection).toBeGreaterThan(-1)
    expect(loop).toBeGreaterThan(connection)
    expect(crawl.slice(loop)).not.toContain('openPage(session.port)')
    expect(crawl).toContain('finally {\n        await closePage(session.port, browserPage)')
    expect(crawl).toContain('const closed = await closePage(session.port, browserPage)')
    expect(crawl).toContain('if (!closed)')
    expect(crawl).toContain('for (let attempt = 0; attempt < 2; attempt++)')
    expect(crawl).toContain('browserPage = await createReplacementPage()')
    expect(crawl).toContain('session = await launch()')
    expect(script).toContain("rejectPending('CDP connection closed')")
    expect(script).toContain('/json/new?${encodeURIComponent(\'about:blank\')}')
    expect(script).toContain('/json/close/${encodeURIComponent(page.targetId)}')
    expect(script).toContain('targets.some(target => target.id === page.targetId)')
    expect(script).toContain('for (let attempt = 0; attempt < 40; attempt++)')
  })

  test('reclaims temporary Chromium profiles on failed launches and exit', () => {
    expect(script).toContain("rmSync(userDataDir, { recursive: true, force: true })")
    expect(script).toContain("rmSync(s.userDataDir, { recursive: true, force: true })")
  })
})
