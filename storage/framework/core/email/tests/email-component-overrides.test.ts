import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultsResourcesPath } from '@stacksjs/path'

// An app overrides a bundled email component by keeping its own copy under
// `resources/components/Email` (`buddy publish:component`, stacksjs/stacks#3032).
// Email rendering passes that directory as `componentsDir` and the bundled set
// as an additional root, so the app's copy wins by name, including inside the
// bundled templates and components that render it.

const scratch = mkdtempSync(join(tmpdir(), 'email-component-overrides-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

async function renderWelcome(appComponents: string): Promise<string> {
  const { renderEmail } = await import('@stacksjs/stx')
  const { html } = await renderEmail(defaultsResourcesPath('emails/welcome.stx'), {
    appName: 'Acme',
    appUrl: 'https://acme.test',
    userName: 'Ada',
    primaryColor: '#3451b2',
    subject: 'Test subject',
  }, {
    componentsDir: appComponents,
    additionalComponentsDirs: [defaultsResourcesPath('components/Email')],
  } as Record<string, unknown>)
  return html
}

describe('email component overrides', () => {
  test('an app EmailButton replaces the bundled one in a bundled template', async () => {
    const app = mkdtempSync(join(scratch, 'app-'))
    writeFileSync(join(app, 'EmailButton.stx'), '<a data-app-email-button="1"><slot /></a>\n')

    const html = await renderWelcome(app)
    expect(html).toContain('data-app-email-button="1"')
    expect(html).not.toContain('mso-padding-alt')
    // The rest of the bundled scaffold still renders.
    expect(html).toContain('max-width:600px')
  }, 60_000)

  test('without an app copy the bundled components render', async () => {
    const html = await renderWelcome(mkdtempSync(join(scratch, 'empty-')))
    expect(html).toContain('mso-padding-alt')
    expect(html).not.toContain('data-app-email-button')
  }, 60_000)

  test('template() renders with these roots', async () => {
    const source = await Bun.file(join(import.meta.dir, '../src/template.ts')).text()
    expect(source).toContain('componentsDir: resourcesPath(\'components/Email\'),')
    expect(source).toContain('additionalComponentsDirs: [defaultsResourcesPath(\'components/Email\')],')
  })
})
