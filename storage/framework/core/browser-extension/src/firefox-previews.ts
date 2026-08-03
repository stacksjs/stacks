import type { ExtensionConfig, FirefoxAddonsConfig } from './types'
import { createHmac, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import process from 'node:process'

/**
 * Listing screenshots on addons.mozilla.org.
 *
 * Of the three stores this package publishes to, AMO is the middle case:
 * Apple's API takes screenshots as part of a version's metadata, Chrome's has
 * no endpoint for them at all, and AMO has a writable previews collection that
 * nothing was using. So a Firefox listing kept whatever was dragged into the
 * Developer Hub the first time — for very-good-adblock, two images at mismatched
 * sizes and captions that said "A screenshot showcasing the extension" — while
 * every other surface regenerated from the product.
 *
 * Replacement is upload-then-delete rather than delete-then-upload. Either
 * order is fine when it works; only one of them leaves a public listing with no
 * screenshots at all if the process dies in the middle.
 */

export interface FirefoxPreviewAuth {
  issuer?: string
  secret?: string
}

export interface FirefoxPreviewSyncOptions extends FirefoxPreviewAuth {
  cwd?: string
  /** Report what would change without touching the listing. */
  dryRun?: boolean
}

export interface FirefoxPreview {
  id: number
  position: number
  size: [number, number]
  caption?: string
}

export interface FirefoxPreviewSyncResult {
  /** Whether the listing already matched and nothing was sent. */
  unchanged: boolean
  uploaded: FirefoxPreview[]
  removed: number[]
}

const AMO_API = 'https://addons.mozilla.org/api/v5'

/**
 * Pixel dimensions of a PNG or JPEG, read from its header.
 *
 * Enough to answer "does the listing already show these images", which is the
 * only reason this file needs to know. Decoding them properly would mean
 * making the whole codec stack a dependency of the publisher, to compare two
 * pairs of integers.
 */
export function imageSize(bytes: Uint8Array): { width: number, height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // PNG: an 8-byte signature, then IHDR carrying width and height.
  if (bytes.length > 24 && view.getUint32(0) === 0x89504E47)
    return { width: view.getUint32(16), height: view.getUint32(20) }

  // JPEG: walk the segments to the frame header, which is the only one that
  // states the size. Segment lengths include their own two bytes.
  if (bytes.length > 4 && view.getUint16(0) === 0xFFD8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (view.getUint8(offset) !== 0xFF) {
        offset++
        continue
      }

      const marker = view.getUint8(offset + 1)
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC)
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }

      offset += 2 + view.getUint16(offset + 2)
    }
  }

  return undefined
}

/**
 * A short-lived HS256 token, which is what AMO's external API takes.
 *
 * Signed here rather than pulled from a JWT library: the payload is four
 * claims and the signature is one HMAC, and `web-ext` — the only other AMO
 * caller in this package — does not expose its own.
 */
export function amoToken(issuer: string, secret: string, now: number = Date.now()): string {
  const base64url = (value: string | Buffer): string =>
    Buffer.from(value).toString('base64url')

  const issuedAt = Math.floor(now / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: issuer,
    jti: randomUUID(),
    iat: issuedAt,
    // AMO rejects anything longer-lived than five minutes.
    exp: issuedAt + 240,
  }))

  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

function resolveAuth(options: FirefoxPreviewAuth): { issuer: string, secret: string } {
  const issuer = options.issuer ?? process.env.AMO_JWT_ISSUER ?? process.env.WEB_EXT_API_KEY
  const secret = options.secret ?? process.env.AMO_JWT_SECRET ?? process.env.WEB_EXT_API_SECRET
  const missing = [!issuer && 'AMO_JWT_ISSUER', !secret && 'AMO_JWT_SECRET'].filter(Boolean)
  if (missing.length)
    throw new Error(`[browser-extension] missing Firefox Add-ons credentials: ${missing.join(', ')}`)

  return { issuer: issuer!, secret: secret! }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * How long AMO wants us to wait, from the `Retry-After` header or, failing
 * that, the sentence it puts in the body ("Expected available in 55 seconds").
 */
function retryAfterMs(response: Response, body: string): number | undefined {
  const header = Number(response.headers.get('retry-after'))
  if (Number.isFinite(header) && header > 0)
    return header * 1000

  const stated = /available in (\d+) seconds?/i.exec(body)
  return stated ? Number(stated[1]) * 1000 : undefined
}

/**
 * One AMO call, waiting out the throttle rather than failing on it.
 *
 * AMO rate-limits writes, and a preview sync is a burst of them: uploading
 * three screenshots and captioning each is six calls back to back. The first
 * run of this hit a 429 partway and left the listing holding two old previews
 * and one new one — not broken, but not what was asked for either.
 *
 * The token is minted per attempt, not passed in: AMO rejects anything older
 * than five minutes, and waiting out a throttle can outlast one.
 */
async function amo(
  path: string,
  auth: { issuer: string, secret: string },
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const response = await fetch(`${AMO_API}${path}`, {
    ...init,
    headers: { Authorization: `JWT ${amoToken(auth.issuer, auth.secret)}`, ...init.headers },
  })

  if (response.ok || response.status === 404)
    return response

  const detail = await response.text().catch(() => '')

  if (response.status === 429 && attempt < 4) {
    await sleep((retryAfterMs(response, detail) ?? 60_000) + 1_000)
    return amo(path, auth, init, attempt + 1)
  }

  throw new Error(`[browser-extension] AMO ${init.method ?? 'GET'} ${path} failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`)
}

/** Read the previews a listing currently shows. */
export async function listFirefoxPreviews(addonId: string, auth: { issuer: string, secret: string }): Promise<FirefoxPreview[]> {
  const response = await amo(`/addons/addon/${encodeURIComponent(addonId)}/`, auth)
  if (response.status === 404)
    return []

  const body = await response.json() as {
    previews?: Array<{ id: number, position?: number, image_size?: [number, number], caption?: string | Record<string, string> | null }>
  }

  return (body.previews ?? []).map((preview, index) => ({
    id: preview.id,
    position: preview.position ?? index,
    size: preview.image_size ?? [0, 0],
    caption: typeof preview.caption === 'string' ? preview.caption : preview.caption?.['en-US'],
  }))
}

/**
 * Bring the listing's screenshots in line with the config.
 *
 * Skips the whole exchange when the listing already shows the same images at
 * the same sizes in the same order — a publish should not churn a public
 * listing's preview ids just because it ran again.
 */
export async function syncFirefoxPreviews(
  config: ExtensionConfig,
  options: FirefoxPreviewSyncOptions = {},
): Promise<FirefoxPreviewSyncResult> {
  const store: FirefoxAddonsConfig = config.firefoxAddons ?? {}
  const screenshots = store.screenshots ?? []
  if (!screenshots.length)
    return { unchanged: true, uploaded: [], removed: [] }

  if (!config.geckoId)
    throw new Error('[browser-extension] Firefox previews need geckoId in config/extension.ts')

  const cwd = options.cwd ?? process.cwd()
  const files = await Promise.all(screenshots.map(async (path) => {
    const file = isAbsolute(path) ? path : resolve(cwd, path)
    const bytes = new Uint8Array(await readFile(file).catch(() => {
      throw new Error(`[browser-extension] Firefox screenshot not found: ${path}`)
    }))
    const size = imageSize(bytes)
    return { path: file, bytes, width: size?.width ?? 0, height: size?.height ?? 0 }
  }))

  const auth = resolveAuth(options)
  const existing = await listFirefoxPreviews(config.geckoId, auth)

  // Dimensions are the only handle AMO gives us on what it is already showing;
  // it reports no checksum. Unreadable local dimensions mean we cannot claim a
  // match, so the sync runs rather than silently skipping.
  const ordered = existing.slice().sort((a, b) => a.position - b.position)
  const measurable = files.every(file => file.width > 0 && file.height > 0)
  const imagesMatch = measurable
    && ordered.length === files.length
    && ordered.every((preview, index) => preview.size[0] === files[index]!.width && preview.size[1] === files[index]!.height)

  const captionFor = (index: number): string => store.screenshotCaptions?.[index] ?? ''
  const drifted = imagesMatch
    ? ordered.map((preview, index) => ({ preview, caption: captionFor(index) })).filter(entry => (entry.preview.caption ?? '') !== entry.caption)
    : []

  if (imagesMatch && !drifted.length)
    return { unchanged: true, uploaded: [], removed: [] }

  // The images are already right and only the words are wrong — which is where
  // a throttled run tends to stop, having uploaded everything and captioned
  // some of it. Re-uploading identical screenshots to fix a sentence would
  // churn the listing's preview ids for nothing.
  if (imagesMatch) {
    if (options.dryRun)
      return { unchanged: false, uploaded: [], removed: [] }

    for (const { preview, caption } of drifted) {
      await amo(`/addons/addon/${encodeURIComponent(config.geckoId)}/previews/${preview.id}/`, auth, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: caption ? { 'en-US': caption } : null }),
      })
    }

    return { unchanged: false, uploaded: ordered, removed: [] }
  }

  if (options.dryRun)
    return { unchanged: false, uploaded: [], removed: existing.map(preview => preview.id) }

  // Upload first, so the listing is never momentarily empty.
  const uploaded: FirefoxPreview[] = []
  for (const [index, file] of files.entries()) {
    const form = new FormData()
    form.append('image', new Blob([file.bytes as BlobPart], { type: 'image/png' }), basename(file.path))
    form.append('position', String(index))

    const response = await amo(`/addons/addon/${encodeURIComponent(config.geckoId)}/previews/`, auth, {
      method: 'POST',
      body: form,
    })
    const created = await response.json() as { id: number }

    const caption = store.screenshotCaptions?.[index]
    if (caption) {
      await amo(`/addons/addon/${encodeURIComponent(config.geckoId)}/previews/${created.id}/`, auth, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: { 'en-US': caption } }),
      })
    }

    uploaded.push({ id: created.id, position: index, size: [file.width, file.height] })
  }

  const removed: number[] = []
  for (const preview of existing) {
    await amo(`/addons/addon/${encodeURIComponent(config.geckoId)}/previews/${preview.id}/`, auth, { method: 'DELETE' })
    removed.push(preview.id)
  }

  return { unchanged: false, uploaded, removed }
}
