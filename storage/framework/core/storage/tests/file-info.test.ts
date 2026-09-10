import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileInfo, fileInfoFromBytes, fileKind, isPreviewable, resolveMime } from '../src/file-info'

/**
 * File information (stacksjs/stacks#308).
 *
 * The two decisions worth pinning are that the mime type comes from the BYTES
 * before the name, and that `previewable` is a claim about what can be
 * rendered here rather than about what is theoretically possible.
 */

const dir = mkdtempSync(join(tmpdir(), 'stacks-fileinfo-'))

afterAll(() => {
  rmSync(dir, { force: true, recursive: true })
})

/** A minimal but real PNG: signature plus an IHDR declaring 1x1. */
function pngBytes(width = 1, height = 1): Uint8Array {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[24] = 8
  bytes[25] = 6
  return bytes
}

describe('resolveMime', () => {
  it('prefers the bytes over the name', () => {
    // An extension is a claim by whoever named the file. A PNG called .txt is
    // a PNG, and for an upload that difference is a security boundary.
    const lying = resolveMime(pngBytes(), 'totally-a-text-file.txt')
    expect(lying.mime).toBe('image/png')
    expect(lying.source).toBe('magic-bytes')
  })

  it('falls back to the extension only when the bytes say nothing', () => {
    const text = new TextEncoder().encode('# hello\n')
    expect(resolveMime(text, 'notes.md')).toEqual({ mime: 'text/markdown', source: 'extension' })
  })

  it('says so when it is guessing at nothing', () => {
    const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05])
    expect(resolveMime(unknown)).toEqual({ mime: 'application/octet-stream', source: 'fallback' })
  })

  it('is case-insensitive about the extension', () => {
    expect(resolveMime(new TextEncoder().encode('x'), 'A.MD').mime).toBe('text/markdown')
  })
})

describe('fileKind', () => {
  it('maps by presentation, not by encoding', () => {
    expect(fileKind('image/png')).toBe('image')
    expect(fileKind('video/mp4')).toBe('video')
    expect(fileKind('audio/mpeg')).toBe('audio')
    expect(fileKind('application/pdf')).toBe('pdf')
    expect(fileKind('application/zip')).toBe('archive')
    expect(fileKind('font/woff2')).toBe('font')
  })

  it('treats the structured text formats as text, since that is how they are shown', () => {
    for (const mime of ['text/plain', 'application/json', 'application/xml', 'application/yaml'])
      expect(fileKind(mime)).toBe('text')
  })

  it('says `other` rather than guessing', () => {
    expect(fileKind('application/octet-stream')).toBe('other')
    expect(fileKind('application/vnd.made-up')).toBe('other')
  })
})

describe('isPreviewable', () => {
  it('is true for images and text', () => {
    expect(isPreviewable('image/png')).toBeTrue()
    expect(isPreviewable('text/plain')).toBeTrue()
  })

  it('excludes SVG despite it being an image', () => {
    // Rendering attacker-supplied SVG is script execution. The decision to do
    // it anyway belongs to the caller who knows where the file came from.
    expect(isPreviewable('image/svg+xml')).toBeFalse()
  })

  it('is false for what cannot be rendered from the bytes alone', () => {
    // Not "no preview is possible" - "not without a transcoder or renderer".
    for (const mime of ['video/mp4', 'application/pdf', 'application/zip', 'application/octet-stream'])
      expect(isPreviewable(mime)).toBeFalse()
  })
})

describe('fileInfoFromBytes', () => {
  it('reads image dimensions', async () => {
    const info = await fileInfoFromBytes(pngBytes(2304, 1964), 'diagram.png')
    expect(info.kind).toBe('image')
    expect(info.image?.width).toBe(2304)
    expect(info.image?.height).toBe(1964)
  })

  it('describes a malformed image rather than throwing', async () => {
    // A truncated upload is the one case a file manager most needs to show.
    const truncated = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00])
    const info = await fileInfoFromBytes(truncated, 'broken.png')

    expect(info.mime).toBe('image/png')
    expect(info.kind).toBe('image')
    expect(info.size).toBe(9)
    expect(info.image).toBeUndefined()
  })

  it('does not try to decode an SVG as a raster image', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const info = await fileInfoFromBytes(svg, 'logo.svg')

    expect(info.kind).toBe('image')
    expect(info.previewable).toBeFalse()
    expect(info.image).toBeUndefined()
  })

  it('works with no name at all, for an upload that has no path yet', async () => {
    const info = await fileInfoFromBytes(pngBytes())
    expect(info.mime).toBe('image/png')
  })

  it('reports the real byte length', async () => {
    const bytes = new Uint8Array(1234)
    expect((await fileInfoFromBytes(bytes)).size).toBe(1234)
  })
})

describe('fileInfo', () => {
  it('reads a file from disk', async () => {
    const path = join(dir, 'sample.png')
    writeFileSync(path, pngBytes(10, 20))

    const info = await fileInfo(path)
    expect(info.mime).toBe('image/png')
    expect(info.image?.width).toBe(10)
    expect(info.image?.height).toBe(20)
  })

  it('uses the path only as the extension fallback', async () => {
    const path = join(dir, 'notes.md')
    writeFileSync(path, '# hi')

    const info = await fileInfo(path)
    expect(info.mime).toBe('text/markdown')
    expect(info.mimeSource).toBe('extension')
  })
})
