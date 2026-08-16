import type { ImagesConfig } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { generateAppStoreScreenshotSet } from '../src/app-store'
import { generateAppIconSet } from '../src/app-icons'
import { generateImages } from '../src/generate'
import { resolveFontPath } from '../src/fonts'
import { socialCardName, socialMetaTags } from '../src/social'
import { generateSocialCardSet } from '../src/social'
import { background, color, device, themed } from '../src/theme'

describe('theme translation', () => {
  test('reads colours out of configuration strings', () => {
    expect(color('#ef4444')).toEqual({ r: 239, g: 68, b: 68, a: 1 })
    expect(color(undefined)).toBeUndefined()
  })

  test('carries a background through with its colours parsed', () => {
    const result = background({
      color: '#120b0c',
      gradient: { angle: 165, stops: [{ offset: 0, color: '#120b0c' }, { offset: 1, color: '#1e1214' }] },
      glows: [{ x: 0.84, y: 0.08, radius: 0.62, color: '#ef444438' }],
    })

    expect(result?.color).toEqual({ r: 18, g: 11, b: 12, a: 1 })
    expect(result?.gradient?.angle).toBe(165)
    expect(result?.gradient?.stops[0]!.color).toEqual({ r: 18, g: 11, b: 12, a: 1 })
    expect(result?.glows?.[0]!.color.a).toBeCloseTo(0.22, 1)
  })

  test('distinguishes "no shadow" from "the default shadow"', () => {
    // `false` means none; an absent key means the renderer's default.
    expect(device({ shadow: false })?.shadow).toBeUndefined()
    expect(device({})?.shadow).toEqual({ color: undefined })
    expect(device({ shadow: { blur: 40, color: '#000000' } })?.shadow).toEqual({
      blur: 40,
      color: { r: 0, g: 0, b: 0, a: 1 },
    })
  })

  test('lets a generator override the shared palette', () => {
    const images: ImagesConfig = { color: '#ffffff', brand: 'Stacks', device: { radius: 0.1 } }
    const merged = themed(images, { color: '#000000', enabled: true })

    expect(merged.color).toBe('#000000')
    expect(merged.brand).toBe('Stacks')
    expect(merged.device).toEqual({ radius: 0.1 })
  })

  // `accent` and `markPlate` were declared on the config and then dropped
  // here, so setting either at the top level did nothing at all: the eyebrow
  // came out in the renderer's built-in orange, and a white plate went down
  // behind a white wordmark and hid it. Both are silent — the card renders,
  // it is just wrong — so they are worth pinning.
  test('inherits the accent', () => {
    expect(themed({ accent: '#5dd37c' }, { enabled: true }).accent).toBe('#5dd37c')
  })

  test('lets a generator override the accent', () => {
    expect(themed({ accent: '#5dd37c' }, { accent: '#ff0000' }).accent).toBe('#ff0000')
  })

  test('inherits the mark plate alongside the mark', () => {
    const images: ImagesConfig = { mark: 'logo.png', markPlate: false }
    const merged = themed(images, { enabled: true })

    expect(merged.mark).toBe('logo.png')
    expect(merged.markPlate).toBe(false)
  })

  test('carries a deliberate `false` plate rather than treating it as unset', () => {
    // `?? ` would fall through to the shared value here and quietly put the
    // plate back, which is the opposite of what the section asked for.
    expect(themed({ markPlate: '#ffffff' }, { markPlate: false }).markPlate).toBe(false)
  })

  test('falls back to the shared plate when a section says nothing', () => {
    expect(themed({ markPlate: '#ffffff' }, { enabled: true }).markPlate).toBe('#ffffff')
  })
})

describe('socialCardName', () => {
  test('keeps the root card on the stable `og` name', () => {
    expect(socialCardName('/')).toBe('og')
    expect(socialCardName('')).toBe('og')
  })

  test('flattens a route into a recognisable file name', () => {
    expect(socialCardName('/features/popups')).toBe('features-popups')
    expect(socialCardName('/privacy/')).toBe('privacy')
    expect(socialCardName('/Features')).toBe('features')
  })
})

describe('socialMetaTags', () => {
  const card = {
    path: '/',
    name: 'og',
    files: { og: '/tmp/og.jpg', square: '/tmp/og-square.jpg' },
    urls: { og: '/social/og.jpg', square: '/social/og-square.jpg' },
    width: 1200,
    height: 630,
    title: 'Ads gone before the page "loads".',
  }

  test('declares the primary card with its dimensions', () => {
    const tags = socialMetaTags(card, 'https://example.com/')

    expect(tags).toContain('<meta property="og:image" content="https://example.com/social/og.jpg">')
    expect(tags).toContain('<meta property="og:image:width" content="1200">')
    expect(tags).toContain('<meta property="og:image:height" content="630">')
    expect(tags).toContain('<meta property="og:image:type" content="image/jpeg">')
  })

  test('asks for the large card rather than the default thumbnail', () => {
    // `summary` renders a small square no matter how good the image is.
    expect(socialMetaTags(card, 'https://example.com')).toContain('<meta name="twitter:card" content="summary_large_image">')
  })

  test('declares exactly one og:image', () => {
    // Repeated og:image is a gallery, not a fallback list: Discord drew all
    // three side by side, each cropped to a sliver.
    const tags = socialMetaTags(card, 'https://example.com')
    const images = tags.filter(tag => tag.startsWith('<meta property="og:image" '))

    expect(images).toHaveLength(1)
    expect(images[0]).toBe('<meta property="og:image" content="https://example.com/social/og.jpg">')
    expect(tags.some(tag => tag.includes('og-square.jpg'))).toBe(false)
  })

  test('escapes the alt text', () => {
    expect(socialMetaTags(card, 'https://example.com').some(tag => tag.includes('&quot;loads&quot;'))).toBe(true)
  })

  test('does not double the slash between host and path', () => {
    expect(socialMetaTags(card, 'https://example.com/')).not.toContain('<meta property="og:image" content="https://example.com//social/og.jpg">')
  })
})

describe('generators without configuration', () => {
  test('produce nothing rather than failing', async () => {
    expect(await generateSocialCardSet({ social: { enabled: false } })).toEqual([])
    expect(await generateAppStoreScreenshotSet({ appStore: { enabled: false } })).toEqual({})
    expect(await generateAppIconSet({ appIcons: { enabled: false } })).toEqual({ icons: [], favicons: [] })
    expect(await generateImages({})).toEqual({ social: [], appStore: {}, appIcons: { icons: [], favicons: [] } })
  })

  test('skip the App Store set when no slides are declared', async () => {
    expect(await generateAppStoreScreenshotSet({ appStore: { enabled: true, displays: ['APP_IPHONE_67'] } })).toEqual({})
  })

  test('restrict a run to the requested generators', async () => {
    const result = await generateImages({ social: { enabled: false } }, { only: ['app-icons'] })
    expect(result.social).toEqual([])
  })
})

describe('font resolution', () => {
  test('explains what to do when the face is missing', () => {
    expect(() => resolveFontPath('fonts/Nope-Bold.ttf', '/tmp')).toThrow(/Font not found/)
    expect(() => resolveFontPath('fonts/Nope-Bold.ttf', '/tmp')).toThrow(/images\.fonts\.title/)
  })

  test('refuses to draw without a configured face', async () => {
    await expect(generateSocialCardSet({ social: { enabled: true } })).rejects.toThrow(/No font configured/)
  })

  test('does not demand a face until a generator is enabled', async () => {
    // A project that has not opted in should never fail an unrelated build
    // over a font it was never asked for.
    await expect(generateImages({ social: {} })).resolves.toBeDefined()
  })
})
