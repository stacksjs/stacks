/**
 * The settings pages that write the project's own files: Mail settings
 * writes the env files the app loads, General settings writes `config/*.ts`
 * (stacksjs/stacks#3320, #3340).
 *
 * The dashboard runs in a scratch project (`scratchProject` in the harness),
 * so these are its copies. Each test also reads the checkout's file before
 * and after, because a save that reached the checkout would pass every other
 * check here: the page would show the new value either way.
 */
import type { Cdp } from '@stacksjs/testing/browser'
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { click, navigate, waitFor } from '@stacksjs/testing/browser'
import { dashboardE2EAvailable, signIn, startDashboardE2E } from './harness'

const checkout = resolve(import.meta.dir, '../../..')

describe.skipIf(!dashboardE2EAvailable)('settings that write the project', () => {
  let e2e: DashboardE2E | undefined

  beforeAll(async () => {
    e2e = await startDashboardE2E()
    await signIn(e2e)
  }, 180_000)

  afterAll(async () => {
    await e2e?.close()
  })

  test('mail settings save the driver to the project .env', async () => {
    const { cdp } = e2e!.browser
    const checkoutEnv = fileText(join(checkout, '.env'))
    await openMailSettings(cdp, e2e!.origin)
    expect(await valueOf(cdp, 'select[aria-label="Mail driver"]')).toBe('log')

    await choose(cdp, 'select[aria-label="Mail driver"]', 'smtp')
    await waitFor(async () => await cdp.evaluate<boolean>(`Boolean(document.querySelector('input[aria-label="Host"]'))`) || null, 5_000, { label: 'the SMTP fields' })
    await fill(cdp, 'input[aria-label="Sender email address"]', 'mail@quillwort.test')
    await fill(cdp, 'input[aria-label="Host"]', 'smtp.quillwort.test')
    await fill(cdp, 'input[aria-label="Port"]', '2525')
    await click(cdp, { selector: 'button[type="submit"]', text: 'Save mail settings' }, { timeoutMs: 5_000 })
    await waitFor(async () => await cdp.evaluate<boolean>(`[...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('Mail settings saved'))`) || null, 15_000, { label: 'the saved message' })

    const saved = envEntries(fileText(join(e2e!.project, '.env')) ?? '')
    expect(saved.MAIL_MAILER).toBe('smtp')
    expect(saved.MAIL_FROM_ADDRESS).toBe('mail@quillwort.test')
    expect(saved.MAIL_HOST).toBe('smtp.quillwort.test')
    expect(saved.MAIL_PORT).toBe('2525')
    expect(fileText(join(checkout, '.env'))).toBe(checkoutEnv)

    // A fresh load reads the file back, not the form it was typed into.
    await openMailSettings(cdp, e2e!.origin)
    expect(await valueOf(cdp, 'select[aria-label="Mail driver"]')).toBe('smtp')
    await waitFor(async () => await valueOf(cdp, 'input[aria-label="Host"]') === 'smtp.quillwort.test' || null, 5_000, { label: 'the saved host' })
  }, 120_000)

  test('a mail value set in a later env file is shown and saved there (stacksjs/stacks#3340)', async () => {
    const { cdp } = e2e!.browser
    // The server runs as APP_ENV=test, so `.env.test` loads after `.env` and wins.
    writeFileSync(join(e2e!.project, '.env.test'), 'MAIL_HOST=layered.quillwort.test\n')
    await openMailSettings(cdp, e2e!.origin)
    await waitFor(async () => await valueOf(cdp, 'input[aria-label="Host"]') === 'layered.quillwort.test' || null, 5_000, { label: 'the host from .env.test' })
    expect(await cdp.evaluate<string>(`document.querySelector('[data-mail-source]')?.textContent ?? ''`)).toBe('.env, .env.test')

    await fill(cdp, 'input[aria-label="Host"]', 'saved-layer.quillwort.test')
    await click(cdp, { selector: 'button[type="submit"]', text: 'Save mail settings' }, { timeoutMs: 5_000 })
    await waitFor(async () => await cdp.evaluate<boolean>(`[...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('Mail settings saved'))`) || null, 15_000, { label: 'the saved message' })

    expect(envEntries(fileText(join(e2e!.project, '.env.test')) ?? '').MAIL_HOST).toBe('saved-layer.quillwort.test')
    expect(envEntries(fileText(join(e2e!.project, '.env')) ?? '').MAIL_HOST).toBe('smtp.quillwort.test')

    await openMailSettings(cdp, e2e!.origin)
    await waitFor(async () => await valueOf(cdp, 'input[aria-label="Host"]') === 'saved-layer.quillwort.test' || null, 5_000, { label: 'the saved host' })
  }, 120_000)

  test('the Environment page opens the later env file and saves it, with its own backup (stacksjs/stacks#3341)', async () => {
    const { cdp } = e2e!.browser
    // The layered mail test left MAIL_HOST in `.env` and, winning, in `.env.test`.
    const envBefore = fileText(join(e2e!.project, '.env'))
    const testBefore = fileText(join(e2e!.project, '.env.test'))
    expect(testBefore).toContain('MAIL_HOST=saved-layer.quillwort.test')

    await navigate(cdp, `${e2e!.origin}/environment`)
    const fileButtons = `[...document.querySelectorAll('[aria-label="Env file"] button')].map(button => button.textContent.trim())`
    await waitFor(async () => (await cdp.evaluate<string[]>(fileButtons)).length === 2 || null, 20_000, { label: 'the env file switcher' })
    expect(await cdp.evaluate<string[]>(fileButtons)).toEqual(['.env', '.env.test'])
    expect(await cdp.evaluate<string>(`document.querySelector('[data-env-read-elsewhere]')?.textContent ?? ''`)).toContain('MAIL_HOST (.env.test)')

    await click(cdp, { selector: '[aria-label="Env file"] button', text: '.env.test' }, { timeoutMs: 5_000 })
    await waitFor(async () => await valueOf(cdp, 'textarea[aria-label=".env.test"]') === testBefore || null, 10_000, { label: '.env.test in the editor' })
    expect(await cdp.evaluate<boolean>(`Boolean(document.querySelector('[data-env-read-elsewhere]'))`)).toBe(false)

    await fill(cdp, 'textarea[aria-label=".env.test"]', 'MAIL_HOST=env-page.quillwort.test\n')
    await click(cdp, { selector: 'button', text: 'Save changes' }, { timeoutMs: 5_000 })
    await waitFor(async () => await cdp.evaluate<boolean>(`[...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('Environment file saved'))`) || null, 15_000, { label: 'the saved message' })

    expect(fileText(join(e2e!.project, '.env.test'))).toBe('MAIL_HOST=env-page.quillwort.test\n')
    expect(fileText(join(e2e!.project, 'storage/framework/runtime/dashboard/environment.test.backup'))).toBe(testBefore)
    expect(fileText(join(e2e!.project, '.env'))).toBe(envBefore)
  }, 120_000)

  test('general settings save a value to the project config file', async () => {
    const { cdp } = e2e!.browser
    const checkoutConfig = fileText(join(checkout, 'config/app.ts'))
    const description = 'Quillwort journey description'
    await openConfig(cdp, e2e!.origin, 'App')
    expect(await valueOf(cdp, '#config-description')).not.toBe(description)

    await fill(cdp, '#config-description', description)
    await click(cdp, { selector: 'button', text: 'Save changes' }, { timeoutMs: 5_000 })
    await waitFor(async () => await cdp.evaluate<boolean>(`document.body.innerText.includes('Saved config/app.ts')`) || null, 15_000, { label: 'the saved message' })

    expect(fileText(join(e2e!.project, 'config/app.ts'))).toContain(`description: '${description}'`)
    expect(fileText(join(checkout, 'config/app.ts'))).toBe(checkoutConfig)

    await openConfig(cdp, e2e!.origin, 'App')
    expect(await valueOf(cdp, '#config-description')).toBe(description)
  }, 120_000)
})

async function openMailSettings(cdp: Cdp, origin: string): Promise<void> {
  await navigate(cdp, `${origin}/settings/mail`)
  await waitFor(async () => await cdp.evaluate<boolean>(`Boolean(document.querySelector('select[aria-label="Mail driver"]'))`) || null, 20_000, { label: 'the mail settings form' })
}

/** Open General settings on one config file, by the name its list shows. */
async function openConfig(cdp: Cdp, origin: string, title: string): Promise<void> {
  await navigate(cdp, `${origin}/settings`)
  await waitFor(async () => await cdp.evaluate<boolean>(`[...document.querySelectorAll('main button')].some(button => button.textContent.trim().startsWith(${JSON.stringify(title)}))`) || null, 20_000, { label: 'the config list' })
  await click(cdp, '.dashboard-settings-config-picker summary')
  await cdp.evaluate(`[...document.querySelectorAll('main button')].find(button => button.textContent.trim().split('\\n')[0].trim() === ${JSON.stringify(title)}).click()`)
  await waitFor(async () => await cdp.evaluate<boolean>(`Boolean(document.querySelector('#config-description'))`) || null, 10_000, { label: `config/${title.toLowerCase()}.ts` })
}

/** Replace a field's text the way typing does: focus it, select what is there, type over it. */
async function fill(cdp: Cdp, selector: string, text: string): Promise<void> {
  await click(cdp, selector, { timeoutMs: 5_000 })
  await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).select()`)
  await cdp.send('Input.insertText', { text })
}

async function choose(cdp: Cdp, selector: string, value: string): Promise<void> {
  await cdp.evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(selector)})
    select.value = ${JSON.stringify(value)}
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
}

async function valueOf(cdp: Cdp, selector: string): Promise<string | null> {
  return await cdp.evaluate<string | null>(`document.querySelector(${JSON.stringify(selector)})?.value ?? null`)
}

function fileText(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

function envEntries(content: string): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const separator = line.indexOf('=')
    if (separator > 0)
      entries[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return entries
}
