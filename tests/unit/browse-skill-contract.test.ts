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
    expect(skill).toContain('browse.ts crawl <url> [--viewport 1280x900] [--max 500] [--path /extra-route] [--settle 350] [--progress]')
    expect(skill).toContain('following every same-origin link it discovers')
    expect(skill).toContain('Repeat `--path` to seed routes that are not')
    expect(skill).toContain('exits\nnonzero when any page fails')
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
    expect(script).toContain('console.error(`[crawl]')
    expect(script).toContain('dispose: () => unsubscribe()')
    expect(script).toContain('state.dispose()')
  })

  test('documents repeatable stateful SPA scenarios', () => {
    expect(skill).toContain('### Scenario (stateful SPA interactions)')
    expect(skill).toContain('Supported actions are `click`, `fill`, `press`, `wait`, and `assert`')
    expect(skill).toContain('"absent":true')
    expect(skill).toContain('preserving reactive STX state and SPA navigation')
    expect(script).toContain("else if (command === 'scenario')")
    expect(script).toContain('flagList(flags.step).map(parseScenarioStep)')
    expect(script).toContain("element.dispatchEvent(new InputEvent('input'")
    expect(script).toContain("step.action === 'click' && step.text !== undefined")
    expect(script).toContain("step.action === 'assert' && step.absent")
    expect(script).toContain("error: 'Expected element to be absent'")
    expect(script).toContain("await cdp.send('Input.dispatchKeyEvent'")
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
    expect(crawl).toContain('for (let attempt = 0; attempt < 2; attempt++)')
    expect(crawl).toContain('browserPage = await createReplacementPage()')
    expect(crawl).toContain('session = await launch()')
    expect(script).toContain("rejectPending('CDP connection closed')")
    expect(script).toContain('/json/new?${encodeURIComponent(\'about:blank\')}')
    expect(script).toContain('/json/close/${encodeURIComponent(page.targetId)}')
  })
})
