import { describe, expect, test } from 'bun:test'
import { defaultsResourcesPath } from '@stacksjs/path'

// stacksjs/stacks#1901 (B1) — <EmailLayout> & co. component library.
//
// Renders the bundled stx email templates directly through stx's
// `renderEmail` with the framework's componentsDir, asserting that
// the bulletproof scaffold lands in the output. We deliberately go
// around the `template()` helper here for unit-level isolation —
// these tests pin the templates/components themselves, independent
// of path resolution. (Since stacksjs/stacks#1944, `template()`
// also resolves the `defaults/` dir as a fallback after userland
// `resources/emails/`; that resolution order is covered by
// template-resolution.test.ts.) The renderer integration with
// `template()` is exercised by the preview tests, which also wire
// through the same `componentsDir`.

async function renderBundled(name: string, vars: Record<string, unknown>): Promise<string> {
  const { renderEmail } = await import('@stacksjs/stx')
  const templatePath = defaultsResourcesPath(`emails/${name}.stx`)
  const componentsDir = defaultsResourcesPath('components/Email')
  const { html } = await renderEmail(templatePath, vars, { componentsDir })
  return html
}

const baseVars = {
  appName: 'Acme',
  appUrl: 'https://acme.test',
  userName: 'Ada',
  primaryColor: '#3451b2',
  subject: 'Test subject',
}

describe('bundled email templates use the <EmailLayout> component', () => {
  test('welcome.stx renders the layout scaffold', async () => {
    const html = await renderBundled('welcome', baseVars)
    expect(html.length).toBeGreaterThan(2000)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<body')
    expect(html).toContain('max-width:600px')
    expect(html).toContain('background-color:#f4f4f5')
    // `title` flows from layout prop, taking the bound subject.
    expect(html).toContain('<title>Test subject</title>')
    // <EmailText size="heading"> renders the heading
    expect(html).toContain('Welcome to Acme!')
    expect(html).toContain('font-weight:600')
    // <EmailButton href=...>Get Started</EmailButton> renders the table CTA
    expect(html).toContain('Get Started')
    expect(html).toContain('href="https://acme.test"')
    expect(html).toContain('mso-padding-alt')
  })

  test('password-reset.stx renders the button + URL fallback', async () => {
    const html = await renderBundled('password-reset', {
      ...baseVars,
      resetUrl: 'https://acme.test/reset/abc123',
      expireMinutes: 30,
    })
    expect(html).toContain('Reset Password')
    expect(html).toContain('href="https://acme.test/reset/abc123"')
    expect(html).toContain('30 minutes')
  })

  test('password-changed.stx renders the security warning panel', async () => {
    const html = await renderBundled('password-changed', {
      ...baseVars,
      changedAt: '2026-05-26T10:00:00Z',
      supportEmail: 'support@acme.test',
    })
    expect(html).toContain("Didn't make this change?")
    expect(html).toContain('support@acme.test')
    expect(html).toContain('2026-05-26T10:00:00Z')
  })

  test('email-verification.stx renders the verify CTA', async () => {
    const html = await renderBundled('email-verification', {
      ...baseVars,
      verificationUrl: 'https://acme.test/verify/xyz',
      expiryMinutes: 15,
    })
    expect(html).toContain('Verify Email Address')
    expect(html).toContain('https://acme.test/verify/xyz')
    expect(html).toContain('15 minutes')
  })

  test('every rendered email carries the bulletproof body wrapper', async () => {
    const html = await renderBundled('welcome', baseVars)
    // <table role="presentation"> is the wrapper every email client
    // respects. Confirming both the outer page-bg row and the inner
    // content card are present.
    expect((html.match(/<table role="presentation"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('cellpadding="0"')
    expect(html).toContain('cellspacing="0"')
  })

  test('EmailButton renders with overridable bg colour', async () => {
    const html = await renderBundled('welcome', { ...baseVars, primaryColor: '#ff00aa' })
    expect(html).toContain('background-color:#ff00aa')
    expect(html).toContain('mso-padding-alt:14px 32px')
  })
})
