import { describe, expect, it } from 'bun:test'
import { htmlToText } from '../src/template'

/**
 * The plain-text part `template()` derives from the HTML. It used to strip
 * every tag and keep the rest: the framework's own password-reset text part
 * had the button's label and no reset link, and every text part opened with
 * the `<title>` and any `<style>` rules as prose.
 */
describe('htmlToText', () => {
  it('keeps where a link goes', () => {
    expect(htmlToText('<p><a href="https://example.com/reset?t=1&amp;u=2">Reset your password</a></p>'))
      .toBe('Reset your password (https://example.com/reset?t=1&u=2)')
  })

  it('does not repeat a URL that is its own label, or print a link to nowhere', () => {
    expect(htmlToText('<a href="https://example.com">https://example.com</a>')).toBe('https://example.com')
    expect(htmlToText('<a href="#">Menu</a>')).toBe('Menu')
    expect(htmlToText('<a href="mailto:hi@example.com">hi@example.com</a>')).toBe('hi@example.com')
  })

  it('drops the head, styles and scripts', () => {
    const html = '<html><head><title>Subject line</title><style>p { color: red }</style></head><body><p>Hello</p><script>track()</script></body></html>'
    expect(htmlToText(html)).toBe('Hello')
  })

  it('trims indentation and keeps at most one blank line', () => {
    expect(htmlToText('<div>\n      <p>  One  </p>\n\n\n\n      <p>Two</p>\n    </div>')).toBe('One\n\nTwo')
  })

  it('decodes numeric entities, and an escaped entity only once', () => {
    expect(htmlToText('<p>Caf&#233; &#x2014; &amp;lt;tag&amp;gt;</p>')).toBe('Café — &lt;tag&gt;')
  })
})
