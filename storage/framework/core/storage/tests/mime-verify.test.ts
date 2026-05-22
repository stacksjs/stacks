import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectMimeFromMagicBytes, verifyUploadedMime } from '../src/mime-verify'
import { Storage } from '../src/facade'

describe('detectMimeFromMagicBytes (stacksjs/stacks#1873 S-3)', () => {
  test('detects PNG signature', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
    expect(detectMimeFromMagicBytes(bytes)).toBe('image/png')
  })

  test('detects JPEG signature', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('image/jpeg')
    expect(detectMimeFromMagicBytes(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1]))).toBe('image/jpeg')
  })

  test('detects GIF signature', () => {
    expect(detectMimeFromMagicBytes(new TextEncoder().encode('GIF87a...'))).toBe('image/gif')
    expect(detectMimeFromMagicBytes(new TextEncoder().encode('GIF89a...'))).toBe('image/gif')
  })

  test('detects WebP via RIFF + WEBP brand', () => {
    const bytes = new Uint8Array(16)
    bytes.set([0x52, 0x49, 0x46, 0x46], 0)
    bytes.set([0, 0, 0, 0], 4)
    bytes.set([0x57, 0x45, 0x42, 0x50], 8)
    expect(detectMimeFromMagicBytes(bytes)).toBe('image/webp')
  })

  test('detects WAV via RIFF + WAVE brand', () => {
    const bytes = new Uint8Array(16)
    bytes.set([0x52, 0x49, 0x46, 0x46], 0)
    bytes.set([0x57, 0x41, 0x56, 0x45], 8)
    expect(detectMimeFromMagicBytes(bytes)).toBe('audio/wav')
  })

  test('detects PDF', () => {
    expect(detectMimeFromMagicBytes(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf')
  })

  test('detects ZIP / OOXML / docx etc', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0x50, 0x4B, 0x03, 0x04]))).toBe('application/zip')
  })

  test('detects AVIF via ftypavif brand', () => {
    const bytes = new Uint8Array(12)
    bytes.set([0, 0, 0, 0x20], 0)
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    bytes.set([0x61, 0x76, 0x69, 0x66], 8)
    expect(detectMimeFromMagicBytes(bytes)).toBe('image/avif')
  })

  test('detects MP4 via ftyp + isom-style brand', () => {
    const bytes = new Uint8Array(12)
    bytes.set([0, 0, 0, 0x20], 0)
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    bytes.set([0x69, 0x73, 0x6F, 0x6D], 8)
    expect(detectMimeFromMagicBytes(bytes)).toBe('video/mp4')
  })

  test('detects WebM/MKV', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0x1A, 0x45, 0xDF, 0xA3]))).toBe('video/webm')
  })

  test('detects MP3 with ID3 tag', () => {
    expect(detectMimeFromMagicBytes(new TextEncoder().encode('ID3.....'))).toBe('audio/mpeg')
  })

  test('detects MP3 without ID3 (sync byte)', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0xFF, 0xFB, 0, 0]))).toBe('audio/mpeg')
  })

  test('returns null for unknown bytes', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBeNull()
    expect(detectMimeFromMagicBytes(new TextEncoder().encode('hello world'))).toBeNull()
  })

  test('returns null for too-short input', () => {
    expect(detectMimeFromMagicBytes(new Uint8Array([0x89, 0x50]))).toBeNull()
  })

  test('accepts ArrayBuffer input', () => {
    const buffer = new ArrayBuffer(8)
    new Uint8Array(buffer).set([0xFF, 0xD8, 0xFF, 0xE0])
    expect(detectMimeFromMagicBytes(buffer)).toBe('image/jpeg')
  })
})

describe('verifyUploadedMime (S3 callsite contract)', () => {
  const testRoot = join(tmpdir(), `stacks-mime-test-${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
    Storage.init({
      default: 'local',
      disks: {
        local: {
          driver: 'local',
          root: testRoot,
          visibility: 'private',
        },
      },
    })
  })

  afterEach(() => {
    Storage.reset()
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore cleanup errors
    }
  })

  test('returns ok=true when bytes match the expected MIME', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
    await Storage.disk().write('avatar.png', png)

    const result = await verifyUploadedMime('avatar.png', 'image/png')
    expect(result.ok).toBe(true)
    expect(result.expected).toBe('image/png')
    expect(result.detected).toBe('image/png')
  })

  test('returns ok=false when bytes are a different known type', async () => {
    // PNG bytes uploaded but claimed as image/jpeg — classic content-type spoof.
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
    await Storage.disk().write('shell.jpg', png)

    const result = await verifyUploadedMime('shell.jpg', 'image/jpeg')
    expect(result.ok).toBe(false)
    expect(result.expected).toBe('image/jpeg')
    expect(result.detected).toBe('image/png')
  })

  test('returns ok=false with detected=null for unidentifiable bytes', async () => {
    await Storage.disk().write('mystery.bin', new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]))

    const result = await verifyUploadedMime('mystery.bin', 'image/png')
    expect(result.ok).toBe(false)
    expect(result.detected).toBeNull()
  })

  test('normalizes content-type parameters before comparison', async () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0])
    await Storage.disk().write('photo.jpg', jpeg)

    const result = await verifyUploadedMime('photo.jpg', 'image/jpeg; charset=binary')
    expect(result.ok).toBe(true)
  })

  test('accepts image/jpg as an alias for image/jpeg', async () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0])
    await Storage.disk().write('photo.jpg', jpeg)

    const result = await verifyUploadedMime('photo.jpg', 'image/jpg')
    expect(result.ok).toBe(true)
    expect(result.detected).toBe('image/jpeg')
  })
})
