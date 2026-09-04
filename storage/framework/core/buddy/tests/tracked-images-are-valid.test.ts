/**
 * Every tracked image really is the format its extension claims.
 *
 * `.gitattributes` was a single `* text=auto` line with no binary rules, so git
 * treated `.png` as text and rewrote every `0D 0A` inside it to `0A` on commit.
 * A PNG opens `89 50 4E 47 0D 0A 1A 0A`; these became `89 50 4E 47 0A 1A 0A 00`.
 * 14 images were committed already broken in 2024 and stayed that way for over
 * a year, until the frontend build started reading them and `ts-images`
 * correctly refused (stacksjs/stacks#2433).
 *
 * The corruption is not reversible - only `0D` bytes that preceded `0A` were
 * dropped, so nothing records which survivors used to have one. The files have
 * to be re-added from their originals.
 *
 * This checks magic bytes rather than decoding: it is the cheap half, it is
 * what actually broke, and it would have caught this on the commit that
 * introduced it.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { $ } from 'bun'

const root = new URL('../../../../../', import.meta.url).pathname

/** First bytes each format must start with. */
const signatures: Record<string, Uint8Array[]> = {
  '.png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  '.jpg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  '.jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  '.gif': [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  '.webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  '.ico': [new Uint8Array([0x00, 0x00, 0x01, 0x00])],
}

/**
 * Files known to be destroyed, still tracked because something references them
 * and no original is available in this repository - the only commit that ever
 * touched them already carried the damage. Replace the file, then delete its
 * line here; the test below fails if one of these turns out to be valid, so the
 * list cannot rot into a permanent exemption.
 */
const knownCorrupt = new Set<string>([
  'public/images/avatars/avatar-1.png',
  'public/images/avatars/avatar-2.png',
  'public/images/avatars/avatar-3.png',
  'public/images/avatars/avatar-4.png',
  'public/images/avatars/avatar-5.png',
  'storage/framework/libs/examples/vue/favicon.png',
  'storage/framework/libs/examples/web/favicon.png',
])

function startsWith(head: Uint8Array, signature: Uint8Array): boolean {
  return signature.every((byte, index) => head[index] === byte)
}

/**
 * Memoized: both tests below need the same answer, and spawning `git ls-files`
 * twice plus re-reading every image pushed this over bun's 5s default when the
 * whole suite runs in parallel.
 */
let cached: Promise<Array<{ file: string, valid: boolean }>> | undefined

function trackedImages(): Promise<Array<{ file: string, valid: boolean }>> {
  cached ??= readTrackedImages()
  return cached
}

async function readTrackedImages(): Promise<Array<{ file: string, valid: boolean }>> {
  const tracked = (await $`git ls-files`.cwd(root).quiet()).text().split('\n').filter(Boolean)

  return tracked
    .filter(file => extname(file).toLowerCase() in signatures)
    .map((file) => {
      let head: Uint8Array
      try {
        head = readFileSync(join(root, file)).subarray(0, 12)
      }
      catch {
        // Absent from the working tree mid-rebase; not this test's business.
        return { file, valid: true }
      }

      const accepted = signatures[extname(file).toLowerCase()]!
      return { file, valid: accepted.some(signature => startsWith(head, signature)) }
    })
}

describe('tracked images', () => {
  it('all start with their format\'s magic bytes', async () => {
    const broken = (await trackedImages())
      .filter(image => !image.valid && !knownCorrupt.has(image.file))
      .map(image => image.file)

    expect(broken.sort()).toEqual([])
  })

  it('lists no file under knownCorrupt that has since been repaired', async () => {
    const images = await trackedImages()
    const repaired = images.filter(image => image.valid && knownCorrupt.has(image.file)).map(image => image.file)

    // Removing the line is the last step of the fix, not an optional tidy-up:
    // left in place, it would exempt a good file from ever being checked again.
    expect(repaired.sort()).toEqual([])
  })
})
