import type { SocialCardPreset } from 'ts-images'
import type { ImagesConfig, SocialCardPageConfig } from '@stacksjs/types'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { generateSocialCards, renderSocialCard } from 'ts-images'
import { loadFonts } from './fonts'
import { background, color, device, markPainter, projectFile, requireProjectFile, themed } from './theme'

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

/**
 * Everything about a card that does not change from page to page.
 *
 * Shared by the build-time set and the on-demand renderer, and shared rather
 * than duplicated for a specific reason: a card drawn at request time that
 * does not match the ones on disk is worse than no card, because the
 * inconsistency only shows up in someone else's timeline.
 */
async function socialCardTheme(images: ImagesConfig, root: string) {
  const social = themed(images, images.social)
  const fonts = await loadFonts(images.fonts, root)
  const mark = await markPainter(social.mark, root)
  // One card by default. The square and portrait crops are for URLs you
  // reference directly; putting them in `og:image` is what made Discord
  // collage the preview, so generating them unasked only invites that.
  const presets = social.presets?.length ? social.presets : (['og'] as SocialCardPreset[])

  return {
    social,
    presets,
    deviceOptions: device(social.device),
    shared: {
      titleFont: fonts.title,
      bodyFont: fonts.body,
      brand: social.brand,
      drawMark: mark?.draw,
      // Declared so a wordmark gets the width it needs rather than being fitted
      // into a square and either shrunk or run over the text beside it.
      markAspect: mark?.aspect,
      // `false` means no plate at all, not "use the default white one": white
      // artwork on a white plate is invisible. ts-images 0.2.8 accepts null for
      // exactly this; the cast is because its published bundle still surfaces
      // the pre-0.2.8 `RGBA | undefined` for the card-SET options, so only the
      // single-card type carries the wider signature.
      markPlate: (social.markPlate === false ? null : color(social.markPlate)) as never,
      surface: background(social.background, root),
      color: color(social.color),
      mutedColor: color(social.mutedColor),
      accent: color(social.accent),
      format: social.format ?? 'jpeg',
      quality: social.quality,
      presets,
    },
  }
}

/**
 * The foreground shot for one page, resolved against the device framing.
 * Shared for the same reason the theme is.
 */
function cardForeground(shot: string | undefined, deviceOptions: ReturnType<typeof device>, root: string, label: string) {
  if (!shot)
    return undefined

  return {
    image: requireProjectFile(shot, root, label),
    radius: deviceOptions?.radius,
    borderColor: deviceOptions?.borderColor,
    shadow: deviceOptions?.shadow,
    scale: deviceOptions?.scale,
  }
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

  const { social, presets, deviceOptions, shared } = await socialCardTheme(images, root)

  const outputDir = projectFile(social.outputDir ?? 'public/social', root)
  const publicPath = `/${(social.publicPath ?? '/social').replace(/^\/+|\/+$/g, '')}`

  await mkdir(outputDir, { recursive: true })

  // A site with no per-page cards still wants one for its root, otherwise the
  // whole feature is inert until someone enumerates every page.
  const pages: SocialCardPageConfig[] = social.pages?.length
    ? social.pages
    : [{ path: '/', title: social.brand ?? 'Home' }]

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
      foreground: cardForeground(shot, deviceOptions, root, `Product shot for ${page.path}`),
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

/** The copy that varies per card, which is all an on-demand caller supplies. */
export interface OnDemandSocialCard {
  title: string
  eyebrow?: string
  subtitle?: string
  /** Overrides the set-wide product shot. */
  foreground?: string
  /** Which crop to draw. Defaults to the first configured preset. */
  preset?: SocialCardPreset
}

/** What a rendered card is, when it is a response body rather than a file. */
export interface RenderedSocialCard {
  bytes: Uint8Array
  contentType: string
  width: number
  height: number
}

/**
 * Draw one card and hand back the bytes, without touching the disk.
 *
 * `generateSocialCardSet` covers the pages a site can enumerate at build time.
 * A forge, a shop, or any app with a page per entity cannot: the card for
 * `/owner/repository` has to be drawn when somebody asks for it. Routing that
 * through a file means inventing a writable directory inside a request
 * handler and reading back what was just written, which is two syscalls and a
 * cleanup problem in exchange for nothing.
 *
 * The theme, fonts, mark and palette come from the same `config/images.ts` the
 * build-time set uses, so a card drawn at request time matches the ones on
 * disk. That consistency is the whole reason this shares `socialCardTheme`
 * rather than taking its own options: a card that does not match only reveals
 * itself in someone else's timeline.
 *
 * **This does not decide who may call it, and a caller must.** Rendering
 * attacker-supplied text into an image served from your own domain is both a
 * CPU amplification vector and a way to put arbitrary words on your brand.
 * Pair it with `signedUrl()` / `verifySignedUrl()` from `@stacksjs/router`, or
 * derive the copy from a record you looked up rather than from the query
 * string. Returns `null` when social cards are not enabled, so an unconfigured
 * app answers 404 rather than 500.
 */
export async function renderOnDemandSocialCard(
  images: ImagesConfig,
  card: OnDemandSocialCard,
  root: string = process.cwd(),
): Promise<RenderedSocialCard | null> {
  if (images.social?.enabled !== true)
    return null

  const { social, presets, deviceOptions, shared } = await socialCardTheme(images, root)
  const preset = card.preset ?? presets[0]!
  const { width, height } = PRESET_SIZES[preset]
  const format = shared.format

  // `presets` belongs to the set API - it names which files to write. A single
  // card is drawn at one explicit size instead, which is what `preset` selects.
  const { presets: _presets, ...cardOptions } = shared

  const bytes = await renderSocialCard({
    ...cardOptions,
    width,
    height,
    title: card.title,
    eyebrow: card.eyebrow,
    subtitle: card.subtitle,
    foreground: cardForeground(card.foreground ?? social.foreground, deviceOptions, root, 'On-demand product shot'),
  })

  return {
    bytes,
    contentType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    width,
    height,
  }
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

  // Deliberately one og:image.
  //
  // The other presets were emitted here too, as alternates for consumers that
  // reserve a taller slot than 1.91:1. Consumers do not choose between them:
  // repeated og:image is a gallery, and Discord drew all three side by side
  // with each cropped to a sliver — a worse preview than the single card it
  // replaced. Facebook and Apple take the first and ignore the rest, so the
  // extras bought nothing even where they were harmless. Reference the other
  // crops by URL where you want that shape.
  return tags
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
