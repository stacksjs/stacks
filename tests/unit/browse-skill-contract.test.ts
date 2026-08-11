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
    expect(script).toContain('document.body.scrollWidth - window.innerWidth')
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

  test('documents repeatable stateful SPA scenarios', () => {
    expect(skill).toContain('### Scenario (stateful SPA interactions)')
    expect(skill).toContain('Supported actions are `click`, `fill`, `focus`, `press`, `wait`, `evaluate`, and `assert`')
    expect(skill).toContain('inspecting STX signals and DevTools state')
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
    expect(script).toContain("step.action === 'evaluate'")
    expect(script).toContain('awaitPromise: true')
    expect(script).toContain('result.exceptionDetails')
    expect(script).toContain("role: document.activeElement.getAttribute?.('role') || null")
    expect(script).toContain("ref: document.activeElement.getAttribute?.('data-stx-ref') || null")
    expect(script).toContain("window.__browseFocusHistory.push({ event: 'focusout'")
    expect(script).toContain('focusHistory: window.__browseFocusHistory || []')
    expect(script).toContain('consoleMessages: state.console')
    expect(script).toContain('state.consoleErrors.length || failedRequests.length')
  })

  test('keeps crawling within the starting origin', () => {
    expect(script).toContain('url.origin !== origin')
    expect(script).toContain("!['http:', 'https:'].includes(url.protocol)")
    expect(script).toContain('url.hash = \'\'')
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
})
