import { expect, test } from 'bun:test'
import { createImageData, encode, getMetadata } from 'ts-images'
import { sanitizeImageUpload } from '../src/upload'

test('private upload normalization removes embedded metadata and applies orientation', async () => {
  const image = createImageData(2, 4)
  image.data.fill(255)
  const jpeg = await encode(image, 'jpeg')
  // A standard little-endian EXIF orientation IFD, followed by a JPEG comment.
  const exif = Buffer.from('45786966000049492a0008000000010012010300010000000600000000000000', 'hex')
  const privateText = Buffer.from('private GPS and camera comment')
  const annotated = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([255, 225, 0, exif.length + 2]), exif,
    Buffer.from([255, 254, 0, privateText.length + 2]), privateText, jpeg.subarray(2)])
  const result = await sanitizeImageUpload(annotated)
  expect(result).toMatchObject({ width: 4, height: 2, format: 'jpeg' })
  expect(Buffer.from(result.bytes).includes(privateText)).toBe(false)
  expect(Buffer.from(result.bytes).includes(Buffer.from('Exif'))).toBe(false)
  expect(await getMetadata(result.bytes)).toMatchObject({ width: 4, height: 2 })
})

test('upload budgets reject bytes and excessive decoded dimensions before publishing', async () => {
  const png = await encode(createImageData(4, 4), 'png')
  await expect(sanitizeImageUpload(png, { maxBytes: 1 })).rejects.toThrow(/byte limit/)
  await expect(sanitizeImageUpload(png, { maxPixels: 15 })).rejects.toThrow(/pixel limit/)
  await expect(sanitizeImageUpload(png, { maxPixels: 0 })).rejects.toThrow(/positive/)
  const result = await sanitizeImageUpload(png)
  expect(result).toMatchObject({ width: 4, height: 4, format: 'png' })
})
