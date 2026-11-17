/**
 * A model's list, as a person uses it: create a record from its form, find
 * it with the search box, and delete it from the list after saying yes, in a
 * real browser on Postgres. Teams, because a team needs only its name.
 *
 * The three run in order and share the one team: each step is the next thing
 * a person does with what the last one left.
 */
import type { Cdp } from '@stacksjs/testing/browser'
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { click, navigate, settle, waitFor } from '@stacksjs/testing/browser'
import { dashboardE2EAvailable, signIn, startDashboardE2E } from './harness'

describe.skipIf(!dashboardE2EAvailable)('a model\'s list', () => {
  let e2e: DashboardE2E | undefined
  // Not a word the seeder's faker writes, so a search for it finds only this team.
  const name = 'Quillwort Journey Team'
  let teamId = 0

  beforeAll(async () => {
    e2e = await startDashboardE2E()
    await signIn(e2e)
  }, 180_000)

  afterAll(async () => {
    await e2e?.close()
  })

  const teamsNamed = async (): Promise<number[]> => (await e2e!.sql<{ id: number }>('SELECT id FROM teams WHERE name = $1', name)).map(row => Number(row.id))

  test('creates a record from its form and opens its page', async () => {
    const { cdp } = e2e!.browser
    expect(await teamsNamed()).toEqual([])
    await navigate(cdp, `${e2e!.origin}/models/team/create`)
    await waitFor(async () => await cdp.evaluate<boolean>(`!!document.querySelector('#model-create-form input[name="name"]')`) || null, 20_000, { label: 'the create form' })
    await click(cdp, '#model-create-form input[name="name"]')
    await cdp.send('Input.insertText', { text: name })
    await click(cdp, { selector: '#model-create-form button[type="submit"]', text: 'Create Team' })

    const created = await waitFor(async () => {
      const ids = await teamsNamed()
      return ids.length > 0 ? ids : null
    }, 20_000, { label: 'the team in the database' })
    expect(created).toHaveLength(1)
    teamId = created[0]!
    await waitFor(async () => (await cdp.evaluate<string>('location.pathname')) === `/models/team/${teamId}` || null, 20_000, { label: 'the new team\'s page' })
  }, 120_000)

  test('finds it by search, and keeps the search in the address', async () => {
    const { cdp } = e2e!.browser
    expect(teamId).toBeGreaterThan(0)
    await openList(cdp, `${e2e!.origin}/models/team`)
    // The seeded teams are listed before anything is typed.
    await waitFor(async () => (await rowTexts(cdp)).length > 1 || null, 15_000, { label: 'the seeded teams' })

    await click(cdp, 'input[type="search"]')
    await cdp.send('Input.insertText', { text: 'Quillwort' })
    const rows = await waitFor(async () => {
      const texts = await rowTexts(cdp)
      return texts.length === 1 ? texts : null
    }, 15_000, { label: 'the list to narrow to one team' })
    expect(rows[0]).toContain(name)
    expect(await cdp.evaluate<string | null>(`new URLSearchParams(location.search).get('q')`)).toBe('Quillwort')

    // Opened again from that address, the list is still the one search.
    await openList(cdp, `${e2e!.origin}/models/team?q=Quillwort`)
    expect(await cdp.evaluate<string>(`document.querySelector('input[type="search"]')?.value ?? ''`)).toBe('Quillwort')
    await waitFor(async () => (await rowTexts(cdp)).length === 1 || null, 15_000, { label: 'the one team again' })
    // and stays that way once nothing is loading.
    await settle(cdp)
    expect(await rowTexts(cdp)).toHaveLength(1)
  }, 120_000)

  test('deletes it from the list after asking first', async () => {
    const { cdp } = e2e!.browser
    expect(teamId).toBeGreaterThan(0)
    await openList(cdp, `${e2e!.origin}/models/team?q=Quillwort`)
    await waitFor(async () => (await rowTexts(cdp)).length === 1 || null, 15_000, { label: 'the team on its list' })
    await click(cdp, `button[aria-label="Delete Team ${teamId}"]`)
    await waitFor(async () => await cdp.evaluate<boolean>(`!!document.querySelector('[role="alertdialog"]')`) || null, 5_000, { label: 'the confirm dialog' })
    // Asking deletes nothing.
    expect(await teamsNamed()).toEqual([teamId])

    await click(cdp, { selector: '[role="alertdialog"] button', text: 'Delete' })
    await waitFor(async () => (await teamsNamed()).length === 0 || null, 15_000, { label: 'the team to leave the database' })
    await waitFor(async () => (await rowTexts(cdp)).length === 0 || null, 15_000, { label: 'the team to leave the list' })
  }, 120_000)
})

/** Open a list and wait for its search box. Each test waits for the rows it expects. */
async function openList(cdp: Cdp, url: string): Promise<void> {
  await navigate(cdp, url)
  await waitFor(async () => await cdp.evaluate<boolean>(`!!document.querySelector('input[type="search"]')`) || null, 20_000, { label: 'the list' })
}

/** The text of each row the list shows. */
async function rowTexts(cdp: Cdp): Promise<string[]> {
  return await cdp.evaluate<string[]>(`[...document.querySelectorAll('tbody tr')].map(row => row.textContent.replace(/\\s+/g, ' ').trim())`)
}
