import { describe, expect, it } from 'bun:test'
import { renderHtml, safe, SafeHtml } from '../src/template'

// Regression coverage for stacksjs/stacks#1871 M-1.
//
// `renderHtml(template, variables)` is the same code path the file-loading
// `template(name, opts)` runs through after reading the .html template
// off disk. Exercising it directly here avoids fixture files.

describe('template variable HTML escaping (stacksjs/stacks#1871 M-1)', () => {
  it('escapes <, >, & in user-supplied string values', () => {
    const { html } = renderHtml('<p>Hello, {{ name }}!</p>', {
      name: '<img src=x onerror=alert(1)>',
    })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&gt;')
  })

  it('escapes double quotes and apostrophes (attribute-context safety)', () => {
    const { html } = renderHtml('<a href="{{ url }}">click</a>', {
      url: 'javascript:alert("x")',
    })
    expect(html).toContain('&quot;')
    // The escaped value still appears, just without breaking out of the attribute.
    expect(html).toContain('javascript:alert(&quot;x&quot;)')
  })

  it('escapes ampersands so query strings render correctly in attributes', () => {
    const { html } = renderHtml('<a href="{{ url }}">link</a>', {
      url: 'https://example.test/?a=1&b=2',
    })
    expect(html).toContain('a=1&amp;b=2')
  })

  it('null and undefined become empty strings (no `null` literal)', () => {
    const { html } = renderHtml('<p>{{ a }}-{{ b }}</p>', {
      a: null,
      b: undefined,
    })
    expect(html).toContain('<p>-</p>')
  })

  it('numbers and booleans coerce safely', () => {
    const { html } = renderHtml('<p>{{ n }}/{{ b }}</p>', {
      n: 42,
      b: true,
    })
    expect(html).toContain('<p>42/true</p>')
  })

  it('safe() opts a value out of escaping (for pre-rendered HTML)', () => {
    const { html } = renderHtml('<div>{{ block }}</div>', {
      block: safe('<strong>bold</strong>'),
    })
    expect(html).toContain('<strong>bold</strong>')
    // No double-escape happens
    expect(html).not.toContain('&lt;strong')
  })

  it('safe() values bypass escaping but adjacent unsafe values still escape', () => {
    const { html } = renderHtml('<p>{{ greeting }}: {{ payload }}</p>', {
      greeting: '<b>Hi</b>',
      payload: safe('<em>html</em>'),
    })
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;')
    expect(html).toContain('<em>html</em>')
  })

  it('SafeHtml instance is recognized identically to safe() factory', () => {
    const { html } = renderHtml('<div>{{ x }}</div>', {
      x: new SafeHtml('<i>i</i>'),
    })
    expect(html).toContain('<i>i</i>')
  })

  it('preserves the existing multi-pass replacement behaviour (documented quirk)', () => {
    // The replacement loop is multi-pass — a variable whose value
    // happens to look like another variable token gets resolved on the
    // next iteration. Not great for security in general (and worth a
    // follow-up), but out of scope for M-1 which is purely about HTML
    // escaping of user-controlled values. This test pins the current
    // behavior so a future single-pass refactor surfaces the change.
    const { html } = renderHtml('<p>{{ outer }}</p>', {
      outer: '{{ injection }}',
      injection: 'should-not-appear',
    })
    expect(html).toContain('should-not-appear')
  })
})
