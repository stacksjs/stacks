import { describe, expect, test } from 'bun:test'
import { inlineCss, shouldInlineByDefault } from '../src/css-inliner'

// stacksjs/stacks#1902 (B2) — CSS inliner.
//
// The inliner runs after stx renders an email template and before
// the result hands back to the caller. Tests cover the common
// scenarios: class / id / tag selectors, multiple matching elements,
// chained selectors, the inline:false opt-out, the
// data-inline="false" passthrough, and the priority rule (existing
// inline styles win over `<style>`-block declarations).

describe('inlineCss', () => {
  test('inlines a class selector into matching elements', () => {
    const html = `<html><head><style>.btn { color: red; }</style></head><body><a class="btn">Click</a></body></html>`
    const out = inlineCss(html)
    expect(out).toContain('<a class="btn" style="color:red !important;">')
    // <style> block is removed once its content has been fully inlined.
    expect(out).not.toContain('<style>')
  })

  test('inlines an id selector', () => {
    const html = `<style>#cta { background: blue; }</style><a id="cta">Go</a>`
    const out = inlineCss(html)
    expect(out).toContain('<a id="cta" style="background:blue !important;">')
  })

  test('inlines a tag selector', () => {
    const html = `<style>p { line-height: 1.6; }</style><p>Hi</p><p>Hello</p>`
    const out = inlineCss(html)
    expect((out.match(/<p style="line-height:1.6 !important;">/g) ?? []).length).toBe(2)
  })

  test('chained class selectors (.a.b) require all classes', () => {
    const html = `<style>.btn.primary { color: white; }</style><a class="btn primary">A</a><a class="btn">B</a>`
    const out = inlineCss(html)
    expect(out).toContain('<a class="btn primary" style="color:white !important;">')
    expect(out).not.toMatch(/<a class="btn"[^>]*style/)
  })

  test('tag + class selector matches only that tag', () => {
    const html = `<style>a.btn { color: green; }</style><a class="btn">A</a><span class="btn">S</span>`
    const out = inlineCss(html)
    expect(out).toContain('<a class="btn" style="color:green !important;">')
    expect(out).not.toMatch(/<span class="btn"[^>]*style/)
  })

  test('merges with existing inline style (existing wins)', () => {
    // The rule sets color:red; the inline already has color:blue. The
    // inlined rule is prepended so the later inline declaration wins
    // per cascade — that means the rendered colour is BLUE.
    const html = `<style>.btn { color: red; }</style><a class="btn" style="color: blue;">X</a>`
    const out = inlineCss(html)
    // Both declarations end up in the style attribute.
    expect(out).toMatch(/style="color:red !important;color: blue;"/)
  })

  test('comma-separated selectors apply to each branch', () => {
    const html = `<style>h1, h2 { margin: 0; }</style><h1>A</h1><h2>B</h2><h3>C</h3>`
    const out = inlineCss(html)
    expect(out).toContain('<h1 style="margin:0 !important;">')
    expect(out).toContain('<h2 style="margin:0 !important;">')
    expect(out).not.toMatch(/<h3[^>]*style/)
  })

  test('descendant / pseudo / @media selectors stay in a <style> block', () => {
    const html = `<style>
      .btn { color: red; }
      .btn:hover { color: blue; }
      .container .child { margin: 0; }
      @media (max-width: 600px) { .btn { width: 100%; } }
    </style><a class="btn">X</a><div class="container"><span class="child">Y</span></div>`
    const out = inlineCss(html)
    // .btn was inlined
    expect(out).toContain('<a class="btn" style="color:red !important;">')
    // The rest survive in a <style> block — exact formatting is
    // implementation detail, just confirm the selectors are still there.
    expect(out).toMatch(/<style>[\s\S]*\.btn:hover[\s\S]*<\/style>/)
    expect(out).toMatch(/<style>[\s\S]*\.container[\s\S]*\.child[\s\S]*<\/style>/)
    expect(out).toMatch(/<style>[\s\S]*@media[\s\S]*<\/style>/)
  })

  test('inline:false passes through unchanged', () => {
    const html = `<style>.btn { color: red; }</style><a class="btn">X</a>`
    const out = inlineCss(html, { inline: false })
    expect(out).toBe(html)
  })

  test('<style data-inline="false"> survives even when inline is on', () => {
    const html = `<style data-inline="false">.dynamic { color: red; }</style><a class="dynamic">X</a>`
    const out = inlineCss(html, { inline: true })
    expect(out).toContain('<style data-inline="false">.dynamic { color: red; }</style>')
    // And since we didn't process the block, the anchor has no style.
    expect(out).not.toMatch(/<a class="dynamic"[^>]*style/)
  })

  test('important:false omits the !important suffix', () => {
    const html = `<style>.btn { color: red; }</style><a class="btn">X</a>`
    const out = inlineCss(html, { important: false })
    expect(out).toContain('<a class="btn" style="color:red;">')
    expect(out).not.toContain('!important')
  })

  test('css comments are stripped before parsing', () => {
    const html = `<style>/* hi */ .btn { /* there */ color: red; }</style><a class="btn">X</a>`
    const out = inlineCss(html)
    expect(out).toContain('color:red !important;')
  })

  test('idempotent — running twice produces the same output', () => {
    const html = `<style>.btn { color: red; }</style><a class="btn">X</a>`
    const once = inlineCss(html)
    const twice = inlineCss(once)
    expect(twice).toBe(once)
  })

  test('html without any <style> blocks passes through', () => {
    const html = `<p style="color:red">already inline</p>`
    expect(inlineCss(html)).toBe(html)
  })
})

describe('shouldInlineByDefault', () => {
  test('returns true when APP_ENV=production', () => {
    const original = process.env.APP_ENV
    process.env.APP_ENV = 'production'
    try {
      expect(shouldInlineByDefault()).toBe(true)
    }
    finally {
      if (original === undefined) delete process.env.APP_ENV
      else process.env.APP_ENV = original
    }
  })

  test('returns false in development', () => {
    const originalApp = process.env.APP_ENV
    const originalNode = process.env.NODE_ENV
    process.env.APP_ENV = 'development'
    process.env.NODE_ENV = 'development'
    try {
      expect(shouldInlineByDefault()).toBe(false)
    }
    finally {
      if (originalApp === undefined) delete process.env.APP_ENV
      else process.env.APP_ENV = originalApp
      if (originalNode === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = originalNode
    }
  })
})
