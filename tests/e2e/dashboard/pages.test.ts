/**
 * Every page the dashboard's sidebar links to loads cleanly, in a real
 * browser, against a real seeded database (stacksjs/stacks#3319).
 *
 * "Cleanly" is what `pageAuditClean` measures: the page went quiet, no
 * same-origin request answered with a status of 400 or more, none was made
 * twice, and no error was raised on the page while it loaded. A page whose
 * shell renders while its data request fails or never answers is exactly
 * what a unit test cannot see and a person sees at once.
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
      const report = await auditPage(`${e2e!.origin}${path}`, { cdp: e2e!.browser.cdp })
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
