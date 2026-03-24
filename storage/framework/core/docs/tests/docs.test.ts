import { describe, expect, test } from 'bun:test'

describe('docs meta exports', () => {
  test('googleapis URL is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.googleapis).toBe('https://fonts.googleapis.com')
  })

  test('gstatic URL is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.gstatic).toBe('https://fonts.gstatic.com')
  })

  test('font URL contains googleapis base', async () => {
    const meta = await import('../src/meta')
    expect(meta.font).toContain('fonts.googleapis.com')
    expect(meta.font).toContain('Readex+Pro')
  })

  test('ogUrl is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.ogUrl).toBe('https://stacksjs.com/')
  })

  test('ogImage includes ogUrl', async () => {
    const meta = await import('../src/meta')
    expect(meta.ogImage).toContain(meta.ogUrl)
    expect(meta.ogImage).toContain('og.png')
  })

  test('github URL is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.github).toContain('github.com/stacksjs/stacks')
  })

  test('releases URL is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.releases).toContain('github.com/stacksjs/stacks/releases')
  })

  test('discord link is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.discord).toBe('https://chat.stacksjs.com')
  })

  test('twitter link is exported', async () => {
    const meta = await import('../src/meta')
    expect(meta.twitter).toContain('twitter.com/stacksjs')
  })

  test('preconnectLinks is an array', async () => {
    const meta = await import('../src/meta')
    expect(Array.isArray(meta.preconnectLinks)).toBe(true)
    expect(meta.preconnectLinks).toContain(meta.googleapis)
    expect(meta.preconnectLinks).toContain(meta.gstatic)
  })

  test('pwaFontsRegex matches googleapis URLs', async () => {
    const meta = await import('../src/meta')
    expect(meta.pwaFontsRegex.test('https://fonts.googleapis.com/css2')).toBe(true)
    expect(meta.pwaFontsRegex.test('https://example.com')).toBe(false)
  })

  test('pwaFontStylesRegex matches gstatic URLs', async () => {
    const meta = await import('../src/meta')
    expect(meta.pwaFontStylesRegex.test('https://fonts.gstatic.com/s/font.woff2')).toBe(true)
    expect(meta.pwaFontStylesRegex.test('https://example.com')).toBe(false)
  })

  test('githubusercontentRegex matches valid URLs', async () => {
    const meta = await import('../src/meta')
    expect(meta.githubusercontentRegex.test('https://raw.githubusercontent.com/foo/bar')).toBe(true)
    expect(meta.githubusercontentRegex.test('https://user-images.githubusercontent.com/123')).toBe(true)
    expect(meta.githubusercontentRegex.test('https://example.com')).toBe(false)
  })
})

describe('docs config exports', () => {
  test('frameworkDefaults is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.frameworkDefaults).toBeDefined()
    expect(typeof mod.frameworkDefaults).toBe('object')
  })

  test('frameworkDefaults has docsDir', async () => {
    const mod = await import('../src/index')
    expect(mod.frameworkDefaults.docsDir).toBeDefined()
  })

  test('frameworkDefaults has outDir', async () => {
    const mod = await import('../src/index')
    expect(mod.frameworkDefaults.outDir).toBeDefined()
  })

  test('docsConfig is exported and merges defaults', async () => {
    const mod = await import('../src/index')
    expect(mod.docsConfig).toBeDefined()
    expect(typeof mod.docsConfig).toBe('object')
  })
})
