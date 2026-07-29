import { describe, expect, it } from 'bun:test'
import { sanitizeInboxHtml } from './sanitize-inbox-html'

describe('sanitizeInboxHtml', () => {
  it('preserves safe email formatting and secures links', () => {
    const html = '<div><strong>Hello</strong><a href="https://example.com">Open</a></div>'
    const result = sanitizeInboxHtml(html)

    expect(result).toContain('<strong>Hello</strong>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('removes executable markup, handlers, remote images, and unsafe URLs', () => {
    const html = [
      '<script>alert("script")</script>',
      '<style>body { display: none }</style>',
      '<img src="https://tracker.example/pixel">',
      '<p onclick="alert(1)">Message</p>',
      '<a href="javascript:alert(1)">Unsafe</a>',
    ].join('')
    const result = sanitizeInboxHtml(html)

    expect(result).not.toContain('<script')
    expect(result).not.toContain('<style')
    expect(result).not.toContain('<img')
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('javascript:')
    expect(result).toContain('<p>Message</p>')
  })
})
