/**
 * Every page the dashboard's sidebar links to loads cleanly, in a real
 * browser, against a real seeded database (stacksjs/stacks#3319).
 *
 * "Cleanly" is what `pageAuditClean` measures: the page went quiet, no
 * same-origin request answered with a status of 400 or more, no accidental
 * duplicate requests were made, and no page error was raised while it
 * loaded. The audit waits for the page's own requests, so a shell whose
 * data request fails or never answers cannot pass.
 */
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { auditPage, formatPageAudit, navigate, pageAuditClean } from '@stacksjs/testing/browser'
import { dashboardE2EAvailable, signIn, startDashboardE2E } from './harness'

describe.skipIf(!dashboardE2EAvailable)('every dashboard page', () => {
  let e2e: DashboardE2E | undefined

  beforeAll(async () => {
    e2e = await startDashboardE2E()
    // As an admin uses it: Remote and Billing are for a signed-in person.
    await signIn(e2e)
  }, 180_000)

  afterAll(async () => {
    await e2e?.close()
  })

  test('the sidebar links somewhere', async () => {
    expect((await sidebarPages(e2e!)).length).toBeGreaterThan(20)
  }, 60_000)

  test('each one loads with no failed request and no page error', async () => {
    const problems: string[] = []
    for (const path of await sidebarPages(e2e!)) {
      const { browser: { cdp }, origin } = e2e!
      // Retire the prior document and its timers before observing this page.
      await navigate(cdp, 'about:blank', { quietMs: 0, includeSpeculative: false })
      const terminal = '/api/dashboard/deployments/terminal'
      const terminalRequests: number[] = []
      const stop = path === '/deployments' ? cdp.on('Network.requestWillBeSent', ({ request, timestamp }) => {
        if (request.method === 'GET' && request.url === origin + terminal)
          terminalRequests.push(timestamp)
      }) : undefined
      const report = await auditPage(origin + path, { cdp, includeSpeculative: false }).finally(() => stop?.())
      // The terminal intentionally polls every four seconds. Keep near-simultaneous
      // requests and every HTTP failure visible in the audit.
      if (path === '/deployments') {
        if (!terminalRequests.length)
          problems.push('/deployments: terminal output was never requested')
        else if (terminalRequests.slice(1).every((time, index) => time - terminalRequests[index]! >= 3.5))
          delete report.duplicates[`GET ${terminal}`]
      }
      if (!pageAuditClean(report))
        problems.push(`${formatPageAudit(report)}${report.errors.length ? `\n  ${report.errors.join('\n  ')}` : ''}`)
    }
    expect(problems).toEqual([])
  }, 900_000)
})

/** The same-origin paths the sidebar links to, each once, in sidebar order. */
async function sidebarPages(e2e: DashboardE2E): Promise<string[]> {
  await navigate(e2e.browser.cdp, `${e2e.origin}/`)
  const hrefs = await e2e.browser.cdp.evaluate<string[]>(`[...document.querySelectorAll('nav a[href]')].map(link => link.getAttribute('href'))`)
  return [...new Set(hrefs.filter(href => href.startsWith('/') && !href.startsWith('//')))]
}
