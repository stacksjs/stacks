import type { SocialCardPreset } from 'ts-images'
import type { ImagesConfig, SocialCardPageConfig } from '@stacksjs/types'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { generateSocialCards } from 'ts-images'
import { loadFonts } from './fonts'
import { background, color, device, markPainter, projectFile, themed } from './theme'

/**
 * Generate the link-preview cards a site declares.
 *
 * The failure this addresses is mundane and universal: a page ships with its
 * favicon as `og:image`, so every share of it renders as a small square icon
 * next to the URL, and the preview — the only part of the page most people
 * ever see — says nothing. Declaring cards in `config/images.ts` and building
 * them with the site keeps them right as the copy changes.
 */

export interface SocialCardResult {
  /** Route the card belongs to. `/` for the site-wide default. */
  path: string
  /** Base file name, without a preset suffix or extension. */
  name: string
  /** Written files, keyed by preset. */
  files: Record<string, string>
  /** Public URLs, keyed by preset. */
  urls: Record<string, string>
  width: number
  height: number
  title: string
}

const PRESET_SIZES: Record<SocialCardPreset, { width: number, height: number }> = {
  og: { width: 1200, height: 630 },
  twitter: { width: 1200, height: 600 },
  square: { width: 1200, height: 1200 },
  portrait: { width: 1200, height: 1500 },
}

/**
 * Name a card after its route.
 *
 * `/` is the site-wide card and keeps the bare `og` name so its URL never
 * moves; everything else is its path with the separators flattened, which
 * makes the file recognisable in a directory listing and stable across
 * regenerations.
 */
export function socialCardName(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? 'og' : trimmed.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

export async function generateSocialCardSet(
  images: ImagesConfig,
  root: string = process.cwd(),
): Promise<SocialCardResult[]> {
  // Opting in is explicit. Cards need a font and a palette the framework
  // cannot invent, so "the section exists" is not enough of a signal to start
  // demanding them — `enabled: true` is.
  if (images.social?.enabled !== true)
    return []

  const social = themed(images, images.social)

  const fonts = await loadFonts(images.fonts, root)
  const outputDir = projectFile(social.outputDir ?? 'public/social', root)
  const publicPath = `/${(social.publicPath ?? '/social').replace(/^\/+|\/+$/g, '')}`
  const presets = social.presets?.length ? social.presets : (['og', 'square', 'portrait'] as SocialCardPreset[])
  const format = social.format ?? 'jpeg'

  await mkdir(outputDir, { recursive: true })

  const drawMark = await markPainter(social.mark, root)
  const shared = {
    titleFont: fonts.title,
    bodyFont: fonts.body,
    brand: social.brand,
    drawMark,
    markPlate: social.markPlate === false ? undefined : color(social.markPlate),
    surface: background(social.background, root),
    color: color(social.color),
    mutedColor: color(social.mutedColor),
    accent: color(social.accent),
    format,
    quality: social.quality,
    presets,
  }

  // A site with no per-page cards still wants one for its root, otherwise the
  // whole feature is inert until someone enumerates every page.
  const pages: SocialCardPageConfig[] = social.pages?.length
    ? social.pages
    : [{ path: '/', title: social.brand ?? 'Home' }]

  const deviceOptions = device(social.device)
  const results: SocialCardResult[] = []

  for (const page of pages) {
    const name = socialCardName(page.path)
    const shot = page.foreground ?? social.foreground

    const files = await generateSocialCards(outputDir, {
      ...shared,
      name,
      title: page.title,
      eyebrow: page.eyebrow,
      subtitle: page.subtitle,
      foreground: shot
        ? {
            image: projectFile(shot, root),
            radius: deviceOptions?.radius,
            borderColor: deviceOptions?.borderColor,
            shadow: deviceOptions?.shadow,
            scale: deviceOptions?.scale,
          }
        : undefined,
    })

    const urls = Object.fromEntries(
      Object.entries(files).map(([preset, file]) => [
        preset,
        `${publicPath}/${file.slice(file.lastIndexOf('/') + 1)}`,
      ]),
    )

    results.push({
      path: page.path,
      name,
      files,
      urls,
      // The primary card's dimensions, which is what `og:image:width` and
      // `og:image:height` have to carry.
      width: PRESET_SIZES[presets[0]!]!.width,
      height: PRESET_SIZES[presets[0]!]!.height,
      title: page.title,
    })
  }

  return results
}

/**
 * The meta tags a page needs so a scraper renders the card at full size.
 *
 * Emitting the image alone is not enough: X falls back to a small square
 * thumbnail unless `twitter:card` says otherwise, and a scraper that cannot
 * fetch the image has nothing to reserve layout with unless the dimensions are
 * declared alongside it.
 */
export function socialMetaTags(card: SocialCardResult, siteUrl: string, format: 'jpeg' | 'png' | 'webp' | 'avif' = 'jpeg'): string[] {
  const base = siteUrl.replace(/\/+$/, '')
  const primary = `${base}${card.urls.og ?? Object.values(card.urls)[0]}`
  const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`

  const tags = [
    `<meta property="og:image" content="${primary}">`,
    `<meta property="og:image:type" content="${mimeType}">`,
    `<meta property="og:image:width" content="${card.width}">`,
    `<meta property="og:image:height" content="${card.height}">`,
    `<meta property="og:image:alt" content="${escapeAttribute(card.title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${primary}">`,
    `<meta name="twitter:image:alt" content="${escapeAttribute(card.title)}">`,
  ]

  // Alternates, for the consumers that prefer a taller crop than 1.91:1.
  for (const [preset, url] of Object.entries(card.urls)) {
    if (preset === 'og')
      continue
    tags.push(`<meta property="og:image" content="${base}${url}">`)
  }

  return tags
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
