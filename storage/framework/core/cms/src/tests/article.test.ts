import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { articleCss, articleScript, imageSize, publicImageResolver, renderPostHtml } from '../article'

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const out: number[] = []
  for (const part of parts)
    out.push(...(typeof part === 'string' ? [...part].map(c => c.charCodeAt(0)) : part))
  return new Uint8Array(out)
}
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const u16le = (n: number): number[] => [n & 255, (n >>> 8) & 255]

const png = (w: number, h: number): Uint8Array => bytes([0x89], 'PNG\r\n\x1A\n', u32(13), 'IHDR', u32(w), u32(h), [8, 2, 0, 0, 0])
const gif = (w: number, h: number): Uint8Array => bytes('GIF89a', u16le(w), u16le(h), [0, 0, 0])
const jpeg = (w: number, h: number): Uint8Array => bytes(
  [0xFF, 0xD8],
  [0xFF, 0xE0], [0, 16], 'JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0],
  [0xFF, 0xC0], [0, 17, 8], [(h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255], [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
)
const webpX = (w: number, h: number): Uint8Array => bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0], [0, 0, 0, 0],
  [(w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255], [(h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255])
const avif = (w: number, h: number): Uint8Array => bytes(u32(20), 'ftyp', 'avif', u32(0), 'mif1', [0, 0, 0, 20], 'ispe', [0, 0, 0, 0], u32(w), u32(h))

describe('imageSize', () => {
  it('reads PNG, GIF, JPEG, WebP and AVIF headers', () => {
    expect(imageSize(png(1600, 1200))).toEqual({ width: 1600, height: 1200 })
    expect(imageSize(gif(320, 240))).toEqual({ width: 320, height: 240 })
    expect(imageSize(jpeg(1200, 1600))).toEqual({ width: 1200, height: 1600 })
    expect(imageSize(webpX(1600, 2133))).toEqual({ width: 1600, height: 2133 })
    expect(imageSize(avif(4032, 3024))).toEqual({ width: 4032, height: 3024 })
  })

  it('returns null for anything else', () => {
    expect(imageSize(bytes('not an image at all'))).toBeNull()
    expect(imageSize(new Uint8Array())).toBeNull()
  })
})

describe('renderPostHtml', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-article-'))
  mkdirSync(join(dir, 'images'))
  writeFileSync(join(dir, 'images/wide.png'), png(1600, 1200))
  writeFileSync(join(dir, 'images/tall.png'), png(1200, 1600))

  it('sizes local images from the files in public/ and lays adjacent ones out as a grid', () => {
    const html = renderPostHtml('<p><img src="/images/wide.png" alt="w"></p>\n<p><img src="/images/tall.png" alt="t"></p>', { publicDir: dir })
    expect(html).toContain('me-grid--2')
    expect(html).toContain('width="1600" height="1200"')
    expect(html).toContain('--me-cols:1.333fr 0.75fr')
  })

  it('never reads outside the public directory, and ignores remote images', () => {
    const resolve = publicImageResolver(dir)
    expect(resolve('/../../etc/passwd')).toBeNull()
    expect(resolve('https://example.com/a.png')).toBeNull()
    expect(resolve('//example.com/a.png')).toBeNull()
    expect(resolve('/images/wide.png?v=2')).toEqual({ width: 1600, height: 1200 })
  })

  it('embeds a bare HQ.training activity link', () => {
    const html = renderPostHtml('<p><a href="https://hq.training/a/mount-hawkins">https://hq.training/a/mount-hawkins</a></p>', { publicDir: dir })
    expect(html).toContain('src="https://hq.training/a/mount-hawkins/embed"')
  })
})

describe('article assets', () => {
  it('ships the stylesheet and a self-mounting module script', () => {
    expect(articleCss()).toContain('.me-grid')
    const script = articleScript()
    expect(script.startsWith('<script type="module" data-stx-scoped>')).toBe(true)
    expect(script).not.toMatch(/export\s*\{/)
    expect(script.slice(0, -'</script>'.length)).not.toContain('</script')
  })
})
