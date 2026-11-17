/**
 * Mail settings live in the database, not in mail storage (S3). With no AWS
 * account at all, as here, the settings page still loads, saves, and shows
 * what was saved. Until 1cefbf5411 it read the inbox's folder counts first,
 * and where nothing answers at the EC2 metadata address that read waits for
 * minutes (stacksjs/ts-cloud#222), so the form never loaded.
 */
import type { Cdp } from '@stacksjs/testing/browser'
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { click, waitFor } from '@stacksjs/testing/browser'
import { dashboardE2EAvailable, signIn, startDashboardE2E } from './harness'

describe.skipIf(!dashboardE2EAvailable)('mail settings', () => {
  let e2e: DashboardE2E | undefined

  beforeAll(async () => {
    e2e = await startDashboardE2E()
    await signIn(e2e)
  }, 180_000)

  afterAll(async () => {
    await e2e?.close()
  })

  test('load and save without waiting for mail storage', async () => {
    const { cdp } = e2e!.browser
    await openSettings(e2e!)
    expect(await density(cdp)).toBe('default')

    await cdp.evaluate(`(() => {
      const select = document.getElementById('displayDensity')
      select.value = 'compact'
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })()`)
    await click(cdp, { selector: 'button', text: 'Save Changes' })
    await waitFor(async () => {
      const rows = await e2e!.sql<{ display_density: string }>('SELECT display_density FROM mail_preferences')
      return rows[0]?.display_density === 'compact' || null
    }, 15_000, { label: 'the saved preference' })

    await openSettings(e2e!)
    expect(await density(cdp)).toBe('compact')
  }, 120_000)
})

/** Open the page and wait for its form to finish loading, the way a person waits for it. */
async function openSettings(e2e: DashboardE2E): Promise<void> {
  const { cdp } = e2e.browser
  await cdp.send('Page.navigate', { url: `${e2e.origin}/inbox/settings` })
  await waitFor(async () => (await cdp.evaluate<string | null>(saveButtonBusy)) === 'false' || null, 20_000, { label: 'the settings form to load' })
}

const saveButtonBusy = `[...document.querySelectorAll('button')].find(button => button.textContent.includes('Save Changes'))?.getAttribute('aria-busy') ?? null`

async function density(cdp: Cdp): Promise<string> {
  return await cdp.evaluate<string>(`document.getElementById('displayDensity')?.value ?? ''`)
}
