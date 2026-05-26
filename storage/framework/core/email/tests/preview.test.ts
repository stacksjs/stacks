import { describe, expect, test } from 'bun:test'
import { renderIndexHtml, renderPreviewHtml } from '../src/preview-ui'
import { discoverMailables } from '../src/preview'
import type { DiscoveredMailable, MailablePreview } from '../src/preview'

// stacksjs/stacks#1900 (A3) — Mailable preview server.
//
// The discovery + render path hits the real `app/Mail/` directory of
// the running project. Tests assert against the shape rather than
// specific Mailables so they survive when apps add / remove their own.
// UI rendering is pure-function — those assertions check structure
// without mocking anything.

describe('discoverMailables', () => {
  test('returns an array (possibly empty)', () => {
    const mailables = discoverMailables()
    expect(Array.isArray(mailables)).toBe(true)
  })

  test('each entry has { name, path, slug }', () => {
    const mailables = discoverMailables()
    for (const m of mailables) {
      expect(typeof m.name).toBe('string')
      expect(typeof m.path).toBe('string')
      expect(typeof m.slug).toBe('string')
      expect(m.path).toContain('/app/Mail/')
      expect(m.path).toMatch(/\.ts$/)
      // slug is kebab-case of name
      expect(m.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  test('entries are sorted alphabetically by name', () => {
    const mailables = discoverMailables()
    if (mailables.length < 2) return // can't compare ordering with 0 or 1 items
    for (let i = 1; i < mailables.length; i++)
      expect(mailables[i].name.localeCompare(mailables[i - 1].name)).toBeGreaterThanOrEqual(0)
  })

  test('skips .d.ts / .test.ts / .spec.ts files', () => {
    const mailables = discoverMailables()
    for (const m of mailables) {
      expect(m.path).not.toMatch(/\.d\.ts$/)
      expect(m.path).not.toMatch(/\.test\.ts$/)
      expect(m.path).not.toMatch(/\.spec\.ts$/)
    }
  })
})

describe('renderIndexHtml', () => {
  test('renders the empty state when no mailables exist', () => {
    const html = renderIndexHtml([])
    expect(html).toContain('No Mailables found')
    expect(html).toContain('buddy make:mail')
  })

  test('renders a list with links when mailables exist', () => {
    const mailables: DiscoveredMailable[] = [
      { name: 'OrderShipped', path: '/p/app/Mail/OrderShipped.ts', slug: 'order-shipped' },
      { name: 'Welcome', path: '/p/app/Mail/Welcome.ts', slug: 'welcome' },
    ]
    const html = renderIndexHtml(mailables)
    expect(html).toContain('OrderShipped')
    expect(html).toContain('Welcome')
    expect(html).toContain('/_stacks/mail/preview/order-shipped')
    expect(html).toContain('/_stacks/mail/preview/welcome')
    expect(html).toContain('2 mailables discovered')
  })

  test('singular wording when exactly one mailable', () => {
    const html = renderIndexHtml([
      { name: 'OrderShipped', path: '/p/app/Mail/OrderShipped.ts', slug: 'order-shipped' },
    ])
    expect(html).toContain('1 mailable discovered')
    expect(html).not.toContain('1 mailables')
  })

  test('escapes name / slug to prevent injection', () => {
    const html = renderIndexHtml([
      { name: '<script>alert(1)</script>', path: '/p/foo.ts', slug: 'evil"slug' },
    ])
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('evil&quot;slug')
  })
})

describe('renderPreviewHtml', () => {
  const mailable: DiscoveredMailable = {
    name: 'OrderShipped',
    path: '/p/app/Mail/OrderShipped.ts',
    slug: 'order-shipped',
  }

  function basePreview(overrides: Partial<MailablePreview> = {}): MailablePreview {
    return {
      inspection: {
        to: ['user@example.com'],
        cc: [],
        bcc: [],
        attachments: [],
        subject: 'Your order shipped',
        template: { name: 'order-shipped', props: { userName: 'Ada' } },
      },
      html: '<p>Hello Ada</p>',
      text: 'Hello Ada',
      sampleProps: { to: 'user@example.com', userName: 'Ada' },
      ...overrides,
    }
  }

  test('renders subject + to + template name', () => {
    const html = renderPreviewHtml(mailable, basePreview())
    expect(html).toContain('Your order shipped')
    expect(html).toContain('user@example.com')
    expect(html).toContain('order-shipped.stx')
  })

  test('renders iframe pointing at /raw for desktop + mobile views', () => {
    expect(renderPreviewHtml(mailable, basePreview(), 'desktop'))
      .toContain('/_stacks/mail/preview/order-shipped/raw')
    const mobile = renderPreviewHtml(mailable, basePreview(), 'mobile')
    expect(mobile).toContain('/_stacks/mail/preview/order-shipped/raw')
    expect(mobile).toContain('class="mobile"')
  })

  test('renders plain-text body in text view (no iframe)', () => {
    const html = renderPreviewHtml(mailable, basePreview(), 'text')
    expect(html).toContain('Hello Ada')
    expect(html).not.toContain('<iframe')
  })

  test('renders error banner when preview.error is set', () => {
    const html = renderPreviewHtml(mailable, basePreview({ error: 'No Mailable subclass exported' }))
    expect(html).toContain('failed to render')
    expect(html).toContain('No Mailable subclass exported')
    // iframe is suppressed when there's an error so the user sees the message
    expect(html).not.toContain('<iframe')
  })

  test('shows the "no sample" hint when sampleProps is null', () => {
    const html = renderPreviewHtml(mailable, basePreview({ sampleProps: null }))
    expect(html).toContain('No sample')
    expect(html).toContain('_previews/order-shipped.ts')
  })

  test('toolbar marks the active view', () => {
    const html = renderPreviewHtml(mailable, basePreview(), 'mobile')
    // Mobile link should be marked active; desktop should not
    const mobileMatch = html.match(/<a href="[^"]*\?view=mobile"\s+class="active">Mobile<\/a>/)
    expect(mobileMatch).toBeTruthy()
  })

  test('renders CC and BCC when present', () => {
    const html = renderPreviewHtml(mailable, basePreview({
      inspection: {
        to: ['a@x.com'],
        cc: ['c@x.com'],
        bcc: ['b@x.com'],
        attachments: [],
        subject: 'multi',
      },
    }))
    expect(html).toContain('c@x.com')
    expect(html).toContain('b@x.com')
  })
})
