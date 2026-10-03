// File previews (stacksjs/stacks#308).
//
// Unlike the rest of the media pipeline, the renderers ARE tested here, not
// just the dispatch: a preview is drawn by this module rather than handed to a
// library that owns the encoding, so whether a WAV becomes a waveform is this
// file's business. Every fixture is built in the test - a PNG from ts-images,
// a WAV from a sine wave, a TrueType font from its tables - so nothing depends
// on a binary checked in beside it.
//
// The store is the in-memory one and the disks are real temp directories, as
// in the other file-manager suites.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageManager } from '@stacksjs/storage'
import { createImageData, decode, encode } from 'ts-images'
import type { DashboardFileNode } from './file-manager'
import {
  deleteDashboardFile,
  dispatchDashboardFileTasks,
  getDashboardFileSnapshot,
  renameDashboardFile,
  reprocessDashboardFile,
} from './file-manager'
import { aggregateTaskState, createMemoryMetadataStore, runTask, StorageTaskSkipped } from './file-metadata'
import {
  claimedContentType,
  generateStoragePreview,
  PREVIEW_MAX_EDGE,
  previewPathFor,
  previewPlanFor,
  readWavFormat,
  TEXT_PREVIEW_MAX_COLUMNS,
  TEXT_PREVIEW_MAX_LINES,
  textSnippet,
} from './file-preview'

let root = ''
let manager: StorageManager
let store = createMemoryMetadataStore()
let dispatched: Array<{ job: string, payload: Record<string, unknown> }> = []
const dispatch = async (job: string, payload: Record<string, unknown>): Promise<void> => {
  dispatched.push({ job, payload })
}

beforeEach(async () => {
  store = createMemoryMetadataStore()
  dispatched = []
  root = await mkdtemp(join(tmpdir(), 'stacks-file-preview-'))
  await mkdir(join(root, 'public'), { recursive: true })
  await mkdir(join(root, 'private'), { recursive: true })
  manager = new StorageManager().init({
    default: 'public',
    disks: {
      public: { driver: 'local', root: join(root, 'public'), url: '/storage', visibility: 'public' },
      private: { driver: 'local', root: join(root, 'private'), visibility: 'private' },
    },
  })
})

afterEach(async () => {
  manager.reset()
  await rm(root, { force: true, recursive: true })
})

function nodeAt(node: DashboardFileNode, path: string): DashboardFileNode | undefined {
  if (node.path === path)
    return node
  for (const child of node.items ?? []) {
    const found = nodeAt(child, path)
    if (found)
      return found
  }
  return undefined
}

async function pngFixture(width = 800, height = 400): Promise<Uint8Array> {
  return await encode(createImageData(width, height, { hasAlpha: true, fill: { r: 200, g: 40, b: 40, a: 255 } }), 'png')
}

/** A mono 16-bit PCM WAV: one second of a swelling sine. */
function wavFixture(sampleRate = 8000): Uint8Array {
  const frames = sampleRate
  const view = new DataView(new ArrayBuffer(44 + frames * 2))
  const tag = (offset: number, value: string): void => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  tag(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  tag(8, 'WAVE')
  tag(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  tag(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++)
    view.setInt16(44 + i * 2, Math.round(Math.sin(i / 8) * 30000 * (i / frames)), true)
  return new Uint8Array(view.buffer)
}

/**
 * A minimal TrueType font: every printable ASCII character is a square.
 *
 * Built table by table - head, hhea, maxp, cmap (format 4), hmtx, loca, glyf -
 * because the only TrueType files on hand are licensed fonts, and the
 * rasterizer needs nothing more than these seven tables to draw.
 */
function fontFixture(): Uint8Array {
  const glyphCount = 0x7F
  const bytes = (size: number, fill: (view: DataView) => void): Uint8Array => {
    const view = new DataView(new ArrayBuffer(size))
    fill(view)
    return new Uint8Array(view.buffer)
  }

  const head = bytes(54, (v) => {
    v.setUint32(0, 0x00010000)
    v.setUint32(12, 0x5F0F3CF5)
    v.setUint16(18, 1000) // unitsPerEm
    v.setInt16(50, 1) // long loca offsets
  })
  const hhea = bytes(36, (v) => {
    v.setUint32(0, 0x00010000)
    v.setInt16(4, 800)
    v.setInt16(6, -200)
    v.setUint16(34, 1) // numberOfHMetrics: every glyph shares one advance
  })
  const maxp = bytes(6, (v) => {
    v.setUint32(0, 0x00005000)
    v.setUint16(4, glyphCount)
  })
  const hmtx = bytes(4, v => v.setUint16(0, 700))

  // One segment mapping 0x20-0x7E straight onto glyph ids, plus the 0xFFFF terminator.
  const cmap = bytes(12 + 32, (v) => {
    v.setUint16(2, 1) // one subtable
    v.setUint16(4, 3) // Windows
    v.setUint16(6, 1) // Unicode BMP
    v.setUint32(8, 12)
    const s = 12
    v.setUint16(s, 4)
    v.setUint16(s + 2, 32)
    v.setUint16(s + 6, 4) // segCountX2
    v.setUint16(s + 14, 0x7E) // endCodes
    v.setUint16(s + 16, 0xFFFF)
    v.setUint16(s + 20, 0x20) // startCodes, after reservedPad
    v.setUint16(s + 22, 0xFFFF)
    v.setInt16(s + 26, 1) // idDelta for the terminator; idRangeOffsets stay 0
  })

  // A square from (100,0) to (600,700): one contour, four on-curve points, word deltas.
  const square = bytes(34, (v) => {
    v.setInt16(0, 1)
    v.setInt16(2, 100)
    v.setInt16(6, 600)
    v.setInt16(8, 700)
    v.setUint16(10, 3) // endPtsOfContours
    for (let i = 0; i < 4; i++) v.setUint8(14 + i, 0x01)
    ;[100, 500, 0, -500].forEach((dx, i) => v.setInt16(18 + i * 2, dx))
    ;[0, 0, 700, 0].forEach((dy, i) => v.setInt16(26 + i * 2, dy))
  })
  const glyf = new Uint8Array(square.byteLength * (glyphCount - 1))
  for (let i = 1; i < glyphCount; i++) glyf.set(square, (i - 1) * square.byteLength)
  const loca = bytes((glyphCount + 1) * 4, (v) => {
    v.setUint32(0, 0) // glyph 0 is empty
    for (let i = 1; i <= glyphCount; i++) v.setUint32(i * 4, (i - 1) * square.byteLength)
  })

  const tables: Array<[string, Uint8Array]> = [['cmap', cmap], ['glyf', glyf], ['head', head], ['hhea', hhea], ['hmtx', hmtx], ['loca', loca], ['maxp', maxp]]
  const directory = 12 + tables.length * 16
  const total = directory + tables.reduce((sum, [, table]) => sum + table.byteLength, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x00010000)
  view.setUint16(4, tables.length)

  let offset = directory
  tables.forEach(([name, table], index) => {
    const record = 12 + index * 16
    for (let i = 0; i < 4; i++) view.setUint8(record + i, name.charCodeAt(i))
    view.setUint32(record + 8, offset)
    view.setUint32(record + 12, table.byteLength)
    out.set(table, offset)
    offset += table.byteLength
  })
  return out
}

describe('previewPlanFor', () => {
  test('draws images, WAV, TrueType and text', () => {
    expect(previewPlanFor('image/png')).toEqual({ renderer: 'image', format: 'png' })
    expect(previewPlanFor('image/jpeg; charset=binary')).toEqual({ renderer: 'image', format: 'png' })
    expect(previewPlanFor('image/webp')).toEqual({ renderer: 'image', format: 'png' })
    expect(previewPlanFor('audio/x-wav')).toEqual({ renderer: 'waveform', format: 'png' })
    expect(previewPlanFor('font/ttf')).toEqual({ renderer: 'font', format: 'png' })
    expect(previewPlanFor('text/markdown')).toEqual({ renderer: 'text', format: 'txt' })
    expect(previewPlanFor('application/json')).toEqual({ renderer: 'text', format: 'txt' })
  })

  test('skips, with a reason, what nothing here can draw', () => {
    for (const mime of ['image/svg+xml', 'image/heic', 'video/mp4', 'audio/mpeg', 'application/pdf', 'font/woff2', 'font/otf'])
      expect(previewPlanFor(mime)).toHaveProperty('skip')
  })

  test('SVG is skipped as markup, never handed to a rasterizer', () => {
    expect((previewPlanFor('image/svg+xml') as { skip: string }).skip).toMatch(/never rasterized/)
  })

  test('says nothing about archives and unknown binaries', () => {
    expect(previewPlanFor('application/zip')).toBeNull()
    expect(previewPlanFor('application/octet-stream')).toBeNull()
    expect(previewPlanFor(undefined)).toBeNull()
  })
})

describe('claimedContentType', () => {
  test('takes the reported type, and the extension only when the report says nothing', () => {
    expect(claimedContentType('a.bin', 'image/png')).toBe('image/png')
    // The local driver reports octet-stream for anything outside its short table.
    expect(claimedContentType('notes.md', 'application/octet-stream')).toBe('text/markdown')
    expect(claimedContentType('face.ttf', undefined)).toBe('font/ttf')
    expect(claimedContentType('photo.webp', '')).toBe('image/webp')
  })
})

describe('dispatch', () => {
  test('an image queues its preview beside its variants and tags', async () => {
    await manager.disk('public').write('photo.png', await pngFixture())

    const tasks = await dispatchDashboardFileTasks({ path: 'photo.png', contentType: 'image/png' }, manager, store, dispatch)

    expect(tasks.map(task => [task.kind, task.state])).toEqual([['optimize', 'queued'], ['tag', 'queued'], ['preview', 'queued']])
    expect(dispatched.map(entry => entry.job)).toEqual(['OptimizeStorageImageJob', 'TagStorageMediaJob', 'GenerateStoragePreviewJob'])
    expect(dispatched[2]?.payload).toEqual({ disk: 'public', path: 'photo.png' })
  })

  test('a markdown file gets a preview even though the disk calls it octet-stream', async () => {
    await manager.disk('public').write('notes.md', '# Notes')

    const tasks = await dispatchDashboardFileTasks({ path: 'notes.md', contentType: 'application/octet-stream' }, manager, store, dispatch)

    expect(tasks.map(task => task.kind)).toEqual(['preview'])
    expect(dispatched.map(entry => entry.job)).toEqual(['GenerateStoragePreviewJob'])
  })

  test('a kind nothing can draw is recorded skipped, with its reason, and never queued', async () => {
    for (const [path, contentType] of [['doc.pdf', 'application/pdf'], ['clip.mp4', 'video/mp4'], ['logo.svg', 'image/svg+xml'], ['song.mp3', 'audio/mpeg']] as const) {
      await manager.disk('public').write(path, 'x')
      const tasks = await dispatchDashboardFileTasks({ path, contentType }, manager, store, dispatch)
      const preview = tasks.find(task => task.kind === 'preview')
      expect(preview?.state).toBe('skipped')
      expect(preview?.error).toBeTruthy()
    }

    // The mp4's tag job is queued; no preview job is, for any of them.
    expect(dispatched.map(entry => entry.job)).toEqual(['TagStorageMediaJob'])
  })

  test('an archive gets no preview row at all', async () => {
    await manager.disk('public').write('bundle.zip', 'x')

    expect(await dispatchDashboardFileTasks({ path: 'bundle.zip', contentType: 'application/zip' }, manager, store, dispatch)).toEqual([])
    expect(await store.tasksUnder('public', '')).toEqual(new Map())
  })

  test('reprocess can re-run just the preview', async () => {
    await manager.disk('public').write('photo.png', await pngFixture())

    const result = await reprocessDashboardFile({ path: 'photo.png', kinds: ['preview'] }, manager, store, dispatch)

    expect(result.tasks.map(task => task.kind)).toEqual(['preview'])
    expect(dispatched.map(entry => entry.job)).toEqual(['GenerateStoragePreviewJob'])
  })
})

describe('generateStoragePreview', () => {
  async function run(path: string, contents: string | Uint8Array, disk = 'public') {
    const adapter = manager.disk(disk)
    await adapter.write(path, contents)
    const result = await generateStoragePreview(adapter, store, disk, path)
    const task = (await store.tasksUnder(disk, path)).get(path)?.find(entry => entry.kind === 'preview')
    return { adapter, result, task }
  }

  test('an image is scaled to fit the preview edge and stored as PNG beside its variants', async () => {
    const { adapter, result, task } = await run('photos/wide.png', await pngFixture(800, 400))

    expect(task?.state).toBe('done')
    expect(result?.path).toBe('.variants/photos/wide.png/preview.png')
    const stored = await decode(new Uint8Array(await adapter.readToBuffer(result!.path)))
    expect([stored.width, stored.height]).toEqual([PREVIEW_MAX_EDGE, PREVIEW_MAX_EDGE / 2])
  })

  test('a small image is not upscaled', async () => {
    const { result } = await run('icon.png', await pngFixture(64, 48))
    expect([result?.width, result?.height]).toEqual([64, 48])
  })

  test('a WAV becomes a waveform', async () => {
    const { adapter, result, task } = await run('sounds/tone.wav', wavFixture())

    expect(task?.state).toBe('done')
    const stored = await decode(new Uint8Array(await adapter.readToBuffer(result!.path)))
    expect([stored.width, stored.height]).toEqual([PREVIEW_MAX_EDGE, 120])
  })

  test('a TrueType font becomes a specimen drawn with itself', async () => {
    const { adapter, result, task } = await run('fonts/face.ttf', fontFixture())

    expect(task?.state).toBe('done')
    const stored = await decode(new Uint8Array(await adapter.readToBuffer(result!.path)))
    // The squares were drawn: some pixel is ink rather than the white ground.
    let inked = false
    for (let i = 0; i < stored.data.length && !inked; i += 4)
      inked = stored.data[i]! < 128
    expect(inked).toBeTrue()
  })

  test('text becomes a snippet of its first lines', async () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i} ${'x'.repeat(200)}`)
    const { adapter, result, task } = await run('notes.md', lines.join('\n'))

    expect(task?.state).toBe('done')
    expect(result?.path).toBe('.variants/notes.md/preview.txt')
    const snippet = await adapter.readToString(result!.path)
    expect(snippet.split('\n')).toHaveLength(TEXT_PREVIEW_MAX_LINES)
    expect(snippet.split('\n').every(line => [...line].length <= TEXT_PREVIEW_MAX_COLUMNS)).toBeTrue()
  })

  test('re-running replaces the preview and the row rather than adding to them', async () => {
    const adapter = manager.disk('public')
    await adapter.write('photo.png', await pngFixture())

    await generateStoragePreview(adapter, store, 'public', 'photo.png')
    await generateStoragePreview(adapter, store, 'public', 'photo.png')

    const tasks = (await store.tasksUnder('public', '')).get('photo.png') ?? []
    expect(tasks.filter(task => task.kind === 'preview')).toHaveLength(1)
    expect(tasks[0]?.state).toBe('done')
    expect(tasks[0]?.attempts).toBe(2)

    const files: string[] = []
    for await (const entry of adapter.list('.variants', { deep: true })) {
      if (entry.type === 'file')
        files.push(String(entry.path))
    }
    expect(files).toHaveLength(1)
  })

  test('a broken image fails, counting the attempt, and rethrows so the queue retries', async () => {
    const corrupt = (await pngFixture()).slice(0, 60)
    const adapter = manager.disk('public')
    await adapter.write('broken.png', corrupt)

    expect(generateStoragePreview(adapter, store, 'public', 'broken.png')).rejects.toThrow()
    await Bun.sleep(0)
    await generateStoragePreview(adapter, store, 'public', 'broken.png').catch(() => {})

    const task = (await store.tasksUnder('public', '')).get('broken.png')?.[0]
    expect(task?.state).toBe('failed')
    expect(task?.attempts).toBe(2)
    expect(task?.error).toBeTruthy()
    expect(await adapter.fileExists(previewPathFor('broken.png'))).toBeFalse()
  })

  test('bytes that disagree with the name are skipped, not drawn as what they really are', async () => {
    // A PDF named .png: the bytes say PDF, and nothing draws a PDF.
    const { adapter, result, task } = await run('fake.png', '%PDF-1.7\n%...')

    expect(result).toBeUndefined()
    expect(task?.state).toBe('skipped')
    expect(task?.error).toMatch(/application\/pdf/)
    expect(await adapter.fileExists(previewPathFor('fake.png'))).toBeFalse()
  })

  test('SVG markup named .png is never rasterized', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    const { adapter, task } = await run('evil.png', svg).catch(async () => ({
      adapter: manager.disk('public'),
      task: (await store.tasksUnder('public', 'evil.png')).get('evil.png')?.[0],
    }))

    expect(task?.state).not.toBe('done')
    expect(await adapter.fileExists(previewPathFor('evil.png'))).toBeFalse()
  })

  test('a compressed font is skipped, not failed', async () => {
    const { task } = await run('face.ttf', 'wOF2 and then some compressed bytes')

    expect(task?.state).toBe('skipped')
    expect(task?.error).toMatch(/WOFF/)
  })

  test('a binary file wearing a text name is skipped', async () => {
    const { task } = await run('data.txt', new Uint8Array([104, 105, 0, 1, 2]))
    expect(task?.state).toBe('skipped')
  })
})

describe('the skipped state', () => {
  test('runTask records a skip and does not rethrow it, so the queue does not retry', async () => {
    const result = await runTask(store, 'public', 'a.pdf', 'preview', async () => {
      throw new StorageTaskSkipped('no renderer')
    })

    expect(result).toBeUndefined()
    const task = (await store.tasksUnder('public', '')).get('a.pdf')?.[0]
    expect(task).toMatchObject({ state: 'skipped', attempts: 1, error: 'no renderer' })
  })

  test('a skipped preview does not mask the work that did apply', () => {
    const skipped = { kind: 'preview', state: 'skipped', attempts: 0 } as const
    expect(aggregateTaskState([{ kind: 'tag', state: 'done', attempts: 1 }, skipped])).toBe('done')
    expect(aggregateTaskState([{ kind: 'tag', state: 'failed', attempts: 1 }, skipped])).toBe('failed')
    expect(aggregateTaskState([skipped])).toBe('skipped')
  })
})

describe('reading previews back', () => {
  test('the listing links a finished preview on the public disk', async () => {
    const adapter = manager.disk('public')
    await adapter.write('photo.png', await pngFixture())
    await generateStoragePreview(adapter, store, 'public', 'photo.png')

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    const node = nodeAt(snapshot.root, 'photo.png')

    expect(node?.preview).toBe('/.variants/photo.png/preview.png')
    // The derivative itself stays out of the listing.
    expect(nodeAt(snapshot.root, '.variants')).toBeUndefined()
  })

  test('a file whose preview has not run has none', async () => {
    await manager.disk('public').write('photo.png', await pngFixture())

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    expect(nodeAt(snapshot.root, 'photo.png')?.preview).toBeUndefined()
  })

  test('a private disk links nothing, but still carries text snippets', async () => {
    const adapter = manager.disk('private')
    await adapter.write('photo.png', await pngFixture())
    await adapter.write('notes.md', '# Title\n\nBody')
    await generateStoragePreview(adapter, store, 'private', 'photo.png')
    await generateStoragePreview(adapter, store, 'private', 'notes.md')

    const snapshot = await getDashboardFileSnapshot({ disk: 'private' }, manager, store)

    expect(nodeAt(snapshot.root, 'photo.png')?.preview).toBeUndefined()
    expect(nodeAt(snapshot.root, 'notes.md')?.previewText).toBe('# Title\n\nBody')
  })

  test('a rename moves the preview with the file, and a delete removes it', async () => {
    const adapter = manager.disk('public')
    await adapter.write('media/photo.png', await pngFixture())
    await generateStoragePreview(adapter, store, 'public', 'media/photo.png')

    await renameDashboardFile({ path: 'media', name: 'images' }, manager, store)
    expect(await adapter.fileExists(previewPathFor('images/photo.png'))).toBeTrue()
    expect(await adapter.fileExists(previewPathFor('media/photo.png'))).toBeFalse()

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    expect(nodeAt(snapshot.root, 'images/photo.png')?.preview).toBe('/.variants/images/photo.png/preview.png')

    await deleteDashboardFile({ path: 'images/photo.png' }, manager, store)
    expect(await adapter.fileExists(previewPathFor('images/photo.png'))).toBeFalse()
  })
})

describe('the pieces', () => {
  test('textSnippet strips control characters and expands tabs', () => {
    expect(textSnippet(new TextEncoder().encode('﻿a\tb\u0007c\r\nnext'))).toBe('a  bc\nnext')
  })

  test('readWavFormat refuses a compressed WAV as a skip', () => {
    const wav = wavFixture()
    new DataView(wav.buffer).setUint16(20, 0x55, true) // MP3-in-WAV
    expect(() => readWavFormat(wav)).toThrow(StorageTaskSkipped)
  })
})
