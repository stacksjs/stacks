import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createImageData, encode } from 'ts-images'
import { image, negotiateImageVariant, resolveImageSource, signImageTransform, verifyImageTransform } from '../src'
const dirs: string[] = []
afterEach(async () => Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))))

describe('@stacksjs/image', () => {
  test('generates content-addressed variants without upscaling', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stacks-image-')); dirs.push(root)
    const input = createImageData(4, 2); input.data.fill(255); await writeFile(join(root, 'hero.png'), await encode(input, 'png'))
    const result = await image('hero.png', { root, outputDir: join(root, 'out') }).widths([2, 8]).formats(['webp', 'png']).generate()
    expect(result.variants.map(item => item.width)).toEqual([2, 2, 4, 4])
    expect(result.placeholder.length).toBeGreaterThan(10)
    expect((await readFile(result.variants[0].path)).length).toBeGreaterThan(0)
  })
  test('negotiates q-values, rejects traversal, and signs transforms', () => {
    const variants = [{ width: 800, height: 450, bytes: 10, format: 'avif' as const, mimeType: 'image/avif', path: '/a', url: '/a', cacheKey: 'a' }, { width: 800, height: 450, bytes: 12, format: 'jpeg' as const, mimeType: 'image/jpeg', path: '/b', url: '/b', cacheKey: 'b' }]
    expect(negotiateImageVariant(variants, 'image/jpeg;q=.5,image/avif;q=1')?.format).toBe('avif')
    expect(() => resolveImageSource('../private.jpg', '/srv/uploads')).toThrow(/inside/)
    const expires = Math.floor(Date.now() / 1000) + 60; const signature = signImageTransform('/hero', expires, 'secret')
    expect(verifyImageTransform('/hero', expires, signature, 'secret')).toBe(true)
  })
})
