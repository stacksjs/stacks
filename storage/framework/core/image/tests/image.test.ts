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
  test('applies presets and authorizes before source reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stacks-image-preset-')); dirs.push(root)
    const input = createImageData(8, 4); input.data.fill(200); await writeFile(join(root, 'avatar.png'), await encode(input, 'png'))
    const result = await image('avatar.png', { root, outputDir: join(root, 'out') }).preset('avatar').widths([2]).formats(['png']).generate()
    expect(result.variants).toHaveLength(1)
    expect(result.variants[0]).toMatchObject({ width: 2, height: 2 })
    await expect(image('missing.png', { root, authorize: () => false }).generate()).rejects.toThrow('not authorized')
  })
  test('publishes image variants through a storage adapter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stacks-image-storage-')); dirs.push(root)
    const input = createImageData(4, 4); input.data.fill(150); await writeFile(join(root, 'image.png'), await encode(input, 'png'))
    const objects = new Map<string, Uint8Array>()
    const adapter = { fileExists: async (path: string) => objects.has(path), write: async (path: string, bytes: Uint8Array) => { objects.set(path, bytes); return { size: bytes.byteLength } }, stat: async (path: string) => ({ size: objects.get(path)!.byteLength }), publicUrl: async (path: string) => `https://media.example/${path}` }
    const result = await image('image.png', { root }).preset('avatar').widths([2]).formats(['webp']).storage(adapter).generate()
    expect(result.variants[0].path).toStartWith('media/images/')
    expect(result.variants[0].url).toStartWith('https://media.example/')
  })
})
