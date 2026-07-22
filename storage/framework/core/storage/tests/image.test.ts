import { describe, expect, test } from 'bun:test'
import { createImageData, decode, encode } from 'ts-images'
import { avatar, resize, stripMetadata, transform } from '../src/image'

async function fixture(): Promise<Uint8Array> {
  const image = createImageData(4, 2)
  image.data.fill(255)
  return encode(image, 'png')
}

describe('@stacksjs/storage/image', () => {
  test('provides native Storage.put transforms', () => {
    expect(typeof avatar()).toBe('function')
    expect(typeof resize(2, 2)).toBe('function')
    expect(typeof stripMetadata()).toBe('function')
    expect(typeof transform(image => image)).toBe('function')
  })

  test('resizes without upscaling and creates square avatars', async () => {
    const source = await fixture()
    const resized = await decode(await resize(2, 2)(source))
    const square = await decode(await avatar(2)(source))
    expect([resized.width, resized.height]).toEqual([2, 1])
    expect([square.width, square.height]).toEqual([2, 2])
  })

  test('validates transforms before encoding', async () => {
    const source = await fixture()
    await expect(transform(image => image.resize(0, 2))(source)).rejects.toThrow(/width/)
    await expect(transform(image => image.webp({ quality: 101 }))(source)).rejects.toThrow(/quality/)
  })
})
