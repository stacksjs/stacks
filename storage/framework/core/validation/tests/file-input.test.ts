import { expect, test } from 'bun:test'
import { file } from '../src/file-validator'

class Upload {
  constructor(readonly size: number, metadata: Record<string, unknown> = {}) { Object.assign(this, metadata) }
}

test('file sizes must be nonnegative safe integer byte counts', () => {
  for (const size of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(file().maxBytes(100).validate(new Upload(size)).valid).toBe(false)
    expect(file().minBytes(0).validate(new Upload(size)).valid).toBe(false)
  }
  expect(file().validate(new Upload(0)).valid).toBe(true)
  expect(file().maxBytes(100).validate(new Upload(100)).valid).toBe(true)
})

test('malformed optional metadata reports validation errors instead of throwing', () => {
  for (const metadata of [{ mimeType: 123 }, { mimetype: {} }, { originalName: 123 }, { name: [] }, { mimeType: null }]) {
    const result = file().image().extensions(['png']).validate(new Upload(1, metadata))
    expect(result.valid).toBe(false)
    expect(result.errors?.length).toBeGreaterThan(0)
  }
  expect(file().image().extensions(['png']).validate(new Upload(1, { mimeType: 'image/png', name: 'photo.png' })).valid).toBe(true)
})
