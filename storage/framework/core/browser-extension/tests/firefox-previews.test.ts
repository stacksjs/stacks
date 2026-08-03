import { describe, expect, it } from 'bun:test'
import { createHmac } from 'node:crypto'
import { amoToken, imageSize } from '../src/firefox-previews'

describe('amoToken', () => {
  it('signs an HS256 token AMO can verify', () => {
    const token = amoToken('user:1:2', 'secret', 1_700_000_000_000)
    const [header, payload, signature] = token.split('.')

    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(createHmac('sha256', 'secret').update(`${header}.${payload}`).digest('base64url')).toBe(signature)
  })

  it('carries the issuer and expires inside AMO\'s five-minute ceiling', () => {
    const now = 1_700_000_000_000
    const claims = JSON.parse(Buffer.from(amoToken('user:1:2', 'secret', now).split('.')[1]!, 'base64url').toString())

    expect(claims.iss).toBe('user:1:2')
    expect(claims.iat).toBe(Math.floor(now / 1000))
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(300)
    expect(claims.exp - claims.iat).toBeGreaterThan(0)
  })

  it('uses a fresh id each time, so a replayed token cannot be reused', () => {
    const first = JSON.parse(Buffer.from(amoToken('i', 's').split('.')[1]!, 'base64url').toString())
    const second = JSON.parse(Buffer.from(amoToken('i', 's').split('.')[1]!, 'base64url').toString())

    expect(first.jti).not.toBe(second.jti)
  })
})

describe('imageSize', () => {
  function png(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(32)
    const view = new DataView(bytes.buffer)
    view.setUint32(0, 0x89504E47)
    view.setUint32(16, width)
    view.setUint32(20, height)
    return bytes
  }

  function jpeg(width: number, height: number): Uint8Array {
    // SOI, a segment to skip over, then SOF0 carrying the dimensions.
    const bytes = new Uint8Array([
      0xFF, 0xD8,
      0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00,
      0xFF, 0xC0, 0x00, 0x11, 0x08,
      (height >> 8) & 0xFF, height & 0xFF,
      (width >> 8) & 0xFF, width & 0xFF,
      0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
    return bytes
  }

  it('reads a PNG header', () => {
    expect(imageSize(png(1280, 800))).toEqual({ width: 1280, height: 800 })
  })

  it('reads a JPEG frame header past an earlier segment', () => {
    expect(imageSize(jpeg(1280, 800))).toEqual({ width: 1280, height: 800 })
  })

  it('returns nothing for bytes it does not recognise', () => {
    expect(imageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeUndefined()
  })
})
