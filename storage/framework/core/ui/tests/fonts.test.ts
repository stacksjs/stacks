import { describe, expect, test } from 'bun:test'
import { renderFontFaceCss, renderFontHead, renderFontPreloads } from '../src/fonts'
import type { FontEntry } from '../src/fonts'

// stacksjs/stacks#283 — web-font CLS mitigation.

describe('renderFontPreloads', () => {
  test('emits a <link rel="preload"> for every font by default', () => {
    const fonts: FontEntry[] = [
      { family: 'Inter', src: '/fonts/inter.woff2' },
      { family: 'JetBrains Mono', src: '/fonts/jbm.woff2' },
    ]
    const out = renderFontPreloads(fonts)
    expect(out).toContain('<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>')
    expect(out).toContain('<link rel="preload" href="/fonts/jbm.woff2" as="font" type="font/woff2" crossorigin>')
  })

  test('skips entries with preload:false', () => {
    const fonts: FontEntry[] = [
      { family: 'Inter', src: '/fonts/inter.woff2' },
      { family: 'Big', src: '/fonts/big.woff2', preload: false },
    ]
    const out = renderFontPreloads(fonts)
    expect(out).toContain('inter.woff2')
    expect(out).not.toContain('big.woff2')
  })

  test('emits the correct MIME type for non-woff2 formats', () => {
    const out = renderFontPreloads([
      { family: 'Legacy', src: '/fonts/old.woff', format: 'woff' },
      { family: 'Vintage', src: '/fonts/old.ttf', format: 'truetype' },
    ])
    expect(out).toContain('type="font/woff"')
    expect(out).toContain('type="font/ttf"')
  })

  test('empty input returns empty string', () => {
    expect(renderFontPreloads([])).toBe('')
    expect(renderFontPreloads()).toBe('')
  })
})

describe('renderFontFaceCss', () => {
  test('emits a default @font-face block with font-display: swap', () => {
    const out = renderFontFaceCss([{ family: 'Inter', src: '/fonts/inter.woff2' }])
    expect(out).toContain(`font-family: 'Inter';`)
    expect(out).toContain(`src: url('/fonts/inter.woff2') format('woff2');`)
    expect(out).toContain('font-display: swap;')
    expect(out).toContain('font-weight: normal;')
    expect(out).toContain('font-style: normal;')
  })

  test('honors explicit weight / style / display', () => {
    const out = renderFontFaceCss([
      {
        family: 'Inter',
        src: '/fonts/inter-bold.woff2',
        weight: 700,
        style: 'italic',
        display: 'optional',
      },
    ])
    expect(out).toContain('font-weight: 700;')
    expect(out).toContain('font-style: italic;')
    expect(out).toContain('font-display: optional;')
  })

  test('emits unicode-range when set', () => {
    const out = renderFontFaceCss([
      {
        family: 'Inter Latin',
        src: '/fonts/inter-latin.woff2',
        unicodeRange: 'U+0000-00FF',
      },
    ])
    expect(out).toContain('unicode-range: U+0000-00FF;')
  })

  test('joins multiple entries with blank lines', () => {
    const out = renderFontFaceCss([
      { family: 'A', src: '/a.woff2' },
      { family: 'B', src: '/b.woff2' },
    ])
    const blocks = out.split('@font-face')
    // First split is the empty leading segment, then 2 blocks → 3 total
    expect(blocks.length).toBe(3)
  })

  test('strips chars that could break out of the @font-face block', () => {
    const out = renderFontFaceCss([
      {
        family: `Inter'; }/* injected */`,
        src: `/fonts/i.woff2'); }/* injected */ url('https://evil`,
      },
    ])
    // Security property: the user-supplied strings must not be able to
    // close out the @font-face block or open a new CSS context. Exactly
    // one block; exactly one `}` (the closer); structure is intact.
    expect(out.match(/@font-face/g)?.length).toBe(1)
    expect(out.match(/\{/g)?.length).toBe(1)
    expect(out.match(/\}/g)?.length).toBe(1)
    // Comment delimiters must not survive intact in the escaped values.
    expect(out).not.toContain('*/')
    // No extra url() entries spliced in.
    expect(out.match(/url\(/g)?.length).toBe(1)
  })
})

describe('renderFontHead', () => {
  test('returns preloads + <style>@font-face</style> together', () => {
    const out = renderFontHead([{ family: 'Inter', src: '/i.woff2' }])
    expect(out).toContain('<link rel="preload"')
    expect(out).toContain('<style>')
    expect(out).toContain('@font-face')
    expect(out).toContain('</style>')
  })

  test('empty input returns empty string', () => {
    expect(renderFontHead([])).toBe('')
    expect(renderFontHead()).toBe('')
  })
})
