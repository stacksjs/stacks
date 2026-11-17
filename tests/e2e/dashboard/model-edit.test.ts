/**
 * A record's edit page saves the record and its related rows together, or
 * not at all (stacksjs/stacks#3315), in a real browser on Postgres
 * (stacksjs/stacks#3319).
 *
 * A user and their team memberships: the user's name is the record, each
 * team member a related row. Team members are the panel a unit test missed:
 * TeamMember requires its userId, and every row added here was refused until
 * b9725a8289.
 */
import type { Cdp } from '@stacksjs/testing/browser'
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { click, navigate, settle, waitFor } from '@stacksjs/testing/browser'
import { dashboardE2EAvailable, signIn, startDashboardE2E } from './harness'

describe.skipIf(!dashboardE2EAvailable)('a record and its rows, saved together', () => {
  let e2e: DashboardE2E | undefined
  let userId = 0
  // Two teams: the first joined in the first test, the second in the
  // rollback, so neither save is refused for repeating a membership.
  let team: { id: number, name: string } = { id: 0, name: '' }
  let otherTeam: { id: number, name: string } = { id: 0, name: '' }

  beforeAll(async () => {
    e2e = await startDashboardE2E()
    await signIn(e2e)
    ;[{ id: userId }] = await e2e.sql<{ id: number }>('SELECT id FROM users ORDER BY id DESC LIMIT 1')
    const teams = await e2e.sql<{ id: number, name: string }>('SELECT id, name FROM teams WHERE id NOT IN (SELECT team_id FROM team_members WHERE user_id = $1) ORDER BY id LIMIT 2', userId)
    if (teams.length < 2) throw new Error('The seeded database needs two teams the user is not in.')
    userId = Number(userId)
    ;[team, otherTeam] = teams.map(row => ({ id: Number(row.id), name: row.name }))
  }, 180_000)

  afterAll(async () => {
    await e2e?.close()
  })

  const name = async (): Promise<string> => (await e2e!.sql<{ name: string }>('SELECT name FROM users WHERE id = $1', userId))[0]!.name
  const memberships = async (): Promise<number> => Number((await e2e!.sql<{ count: number }>('SELECT count(*) AS count FROM team_members WHERE user_id = $1', userId))[0]!.count)

  test('writes the record and a new row in one save', async () => {
    const { cdp } = e2e!.browser
    const before = await memberships()
    await openEditPage(cdp, e2e!.origin, userId)
    await rename(cdp, 'Saved Together')
    await addTeamMember(cdp, team.name)
    await save(cdp)

    await waitFor(async () => (await cdp.evaluate<string>('location.pathname')) === '/models/user' || null, 20_000, { label: 'the save to return to the list' })
    expect(await name()).toBe('Saved Together')
    expect(await memberships()).toBe(before + 1)
  }, 120_000)

  test('keeps nothing when one row is refused, and says which', async () => {
    const { cdp } = e2e!.browser
    const nameBefore = await name()
    const membershipsBefore = await memberships()
    // A team deleted while the form is open: the database refuses the second
    // row on its foreign key, after the rename and the first row are written.
    const [{ id: doomed }] = await e2e!.sql<{ id: number }>(`INSERT INTO teams (name, created_at) VALUES ('Doomed Team', now()) RETURNING id`)

    await openEditPage(cdp, e2e!.origin, userId)
    await rename(cdp, 'Never Saved')
    await addTeamMember(cdp, otherTeam.name)
    await addTeamMember(cdp, 'Doomed Team')
    await e2e!.sql('DELETE FROM teams WHERE id = $1', doomed)
    await save(cdp)

    const alert = await waitFor(async () => await cdp.evaluate<string | null>(`[...document.querySelectorAll('[role="alert"]')].map(node => node.textContent.trim()).find(text => text.startsWith('Nothing was saved.')) ?? null`), 20_000, { label: 'the refusal' })
    expect(alert).toContain('That team no longer exists.')
    // Only the team was gone; the message must not blame the user (24557f9529).
    expect(alert).not.toContain('That user no longer exists.')
    expect(await name()).toBe(nameBefore)
    expect(await memberships()).toBe(membershipsBefore)
  }, 120_000)

  test('says when the person already belongs to that team', async () => {
    const { cdp } = e2e!.browser
    const membershipsBefore = await memberships()
    await openEditPage(cdp, e2e!.origin, userId)
    // The first test made this user a member of this team.
    await addTeamMember(cdp, team.name)
    await save(cdp)

    const alert = await waitFor(async () => await cdp.evaluate<string | null>(`[...document.querySelectorAll('[role="alert"]')].map(node => node.textContent.trim()).find(text => text.startsWith('Nothing was saved.')) ?? null`), 20_000, { label: 'the refusal' })
    expect(alert).toContain('That team and user combination is already in use.')
    expect(await memberships()).toBe(membershipsBefore)
  }, 120_000)

  // stx once rendered each row's Edit, Delete and Discard as an empty
  // placeholder inside the nested lists (stacksjs/stx#2197, fixed in stx
  // 0.2.908), so a staged row could not be taken back.
  test('a staged row can be discarded (stacksjs/stx#2197)', async () => {
    const { cdp } = e2e!.browser
    await openEditPage(cdp, e2e!.origin, userId)
    await addTeamMember(cdp, team.name)
    const staged = `document.querySelectorAll('[data-draft-state="added"]').length`
    expect(await cdp.evaluate<number>(staged)).toBe(1)
    expect(await cdp.evaluate<number>(`document.querySelectorAll('[data-draft-state] [data-stx-lazy]').length`)).toBe(0)
    await click(cdp, { selector: '[data-draft-state="added"] button', text: 'Discard' }, { timeoutMs: 5_000 })
    await waitFor(async () => await cdp.evaluate<number>(staged) === 0 || null, 5_000, { label: 'the staged row to go' })
  }, 60_000)
})

async function openEditPage(cdp: Cdp, origin: string, id: number): Promise<void> {
  await navigate(cdp, `${origin}/models/user/${id}/edit`)
  await waitFor(async () => await cdp.evaluate<boolean>(`!!document.querySelector('#model-edit-form input[name="name"]') && [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Add team member')`) || null, 20_000, { label: 'the edit page and its panels' })
}

/** Replace the record's name, typed the way a person types it. */
async function rename(cdp: Cdp, value: string): Promise<void> {
  await click(cdp, '#model-edit-form input[name="name"]')
  await cdp.evaluate(`document.querySelector('#model-edit-form input[name="name"]').select()`)
  await cdp.send('Input.insertText', { text: value })
}

/** Stage a team member: open the row form, choose the team by name, keep it. */
async function addTeamMember(cdp: Cdp, teamName: string): Promise<void> {
  await click(cdp, { selector: 'button', text: 'Add team member' })
  await click(cdp, '[data-related-draft-editor] input[role="combobox"]')
  await cdp.send('Input.insertText', { text: teamName })
  // The list redraws as the search answers; choose once it has answered.
  // An option shows the record's id beside its name, so its first span is
  // the name. It is chosen from the keyboard, as a person can: the picker
  // takes a pointer on mousedown, which removes the option while a click is
  // still being delivered.
  const named = `[...document.querySelectorAll('[role="option"]')].find(option => option.querySelector('span')?.textContent.trim() === ${JSON.stringify(teamName)})`
  await waitFor(async () => await cdp.evaluate<boolean>(`!!${named}`) || null, 10_000, { label: `an option named ${teamName}` })
  await settle(cdp)
  for (let step = 0; step < 20 && !(await cdp.evaluate<boolean>(`${named}?.getAttribute('aria-selected') === 'true'`)); step++)
    await press(cdp, 'ArrowDown')
  await press(cdp, 'Enter')
  await click(cdp, { selector: '[data-related-draft-editor] button[type="submit"]', text: 'Keep' })
  await waitFor(async () => await cdp.evaluate<boolean>(`!document.querySelector('[data-related-draft-editor]')`) || null, 10_000, { label: 'the row form to close' })
}

async function save(cdp: Cdp): Promise<void> {
  await click(cdp, { selector: 'button[type="submit"]', text: 'Save changes' })
}

async function press(cdp: Cdp, key: 'ArrowDown' | 'Enter'): Promise<void> {
  const code = key === 'Enter' ? 13 : 40
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code })
}
