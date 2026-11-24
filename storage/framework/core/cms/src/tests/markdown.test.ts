import { describe, expect, it } from 'bun:test'
import { renderPostBody } from '../blog'
import { renderSafeMarkdown, safeUrl } from '../markdown'

describe('renderSafeMarkdown', () => {
  it('shows a script tag as text', () => {
    const html = renderSafeMarkdown('Hello <script>alert(1)</script>\n\n<script>\nalert(2)\n</script>')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('shows an element with an event handler as text', () => {
    const html = renderSafeMarkdown('<img src=x onerror="alert(1)">\n\nInline <b onmouseover="alert(2)">bold</b>')
    expect(html).not.toMatch(/<img|<b\b/)
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  it('drops links and images with unsafe schemes', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java&#x73;cript:alert(1)', 'java&#115;cript:alert(1)', 'data:text/html,x', 'vbscript:x', '<javascript:alert(1)>']) {
      const html = renderSafeMarkdown(`[link](${url})\n\n![image](${url})`)
      expect(html).not.toContain('href=')
      expect(html).not.toContain('src=')
      expect(html.toLowerCase()).not.toContain('javascript:alert')
    }
    // A raw autolink is not a link at all.
    expect(renderSafeMarkdown('<javascript:alert(1)>')).not.toContain('<a')
  })

  it('keeps http, https, mailto, relative and anchor links', () => {
    const html = renderSafeMarkdown('[a](https://example.com/x?y=1&z=2) [b](http://example.com) [c](mailto:a@example.com) [d](/blog/post) [e](../up) [f](#section) [g](post.md)\n\n![pic](/images/a.png "Caption")')
    for (const href of ['https://example.com/x?y=1&amp;z=2', 'http://example.com', 'mailto:a@example.com', '/blog/post', '../up', '#section', 'post.md'])
      expect(html).toContain(`href="${href}"`)
    expect(html).toContain('<img src="/images/a.png" alt="pic" title="Caption"')
  })

  it('does not read an attribute out of a link title', () => {
    const html = renderSafeMarkdown('[x](javascript:alert(1) "a href=")')
    expect(html).not.toContain('javascript:')
  })

  it('shows < in code as <, not &lt;', () => {
    const html = renderSafeMarkdown('Inline `<b>code</b>` here.\n\n```html\n<div onclick="x">block</div>\n```')
    expect(html).toContain('<code>&lt;b&gt;code&lt;/b&gt;</code>')
    expect(html).toContain('<code class="language-html">&lt;div onclick=&quot;x&quot;&gt;block&lt;/div&gt;')
    expect(html).not.toContain('&amp;lt;')
  })

  it('renders GFM and heading ids', () => {
    const html = renderSafeMarkdown('# Title\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n\n~~old~~ https://example.com')
    expect(html).toContain('<h1 id="title">Title</h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('checked')
    expect(html).toContain('<del>old</del>')
    expect(html).toContain('<a href="https://example.com">')
  })
})

describe('safeUrl', () => {
  it('refuses controls, whitespace and backslashes', () => {
    expect(safeUrl('java\tscript:x')).toBeNull()
    expect(safeUrl('java\u0000script:x')).toBeNull()
    expect(safeUrl('/\\evil.example')).toBeNull()
  })

  it('allows mailto for links but not images', () => {
    expect(safeUrl('mailto:a@example.com')).toBe('mailto:a@example.com')
    expect(safeUrl('mailto:a@example.com', 'image')).toBeNull()
  })

  it('treats a colon after a path, query or fragment as part of a relative URL', () => {
    expect(safeUrl('/a:b')).toBe('/a:b')
    expect(safeUrl('?q=a:b')).toBe('?q=a:b')
    expect(safeUrl('#a:b')).toBe('#a:b')
  })
})

describe('renderPostBody', () => {
  it('escapes HTML and drops unsafe links', () => {
    const html = renderPostBody('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[x](javascript:alert(3))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
  })
})
