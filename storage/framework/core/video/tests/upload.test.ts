import { describe, expect, test } from 'bun:test'
import { inspectVideo, inspectVideoFile, isFaststart, webReadyProblems } from '../src'
import { canPrepareVideoUpload, prepareVideoUpload } from '../src/browser'

const fixture = (name: string): string => new URL(`fixtures/${name}`, import.meta.url).pathname
const bytesOf = async (name: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(fixture(name)).arrayBuffer())

// portrait-phone.mov: what a phone held upright records, small. HEVC at 60
// frames a second, stored 640x360 with a quarter turn, AAC at 48 kHz, index
// at the end. portrait-prepared.mp4 is that clip after prepareVideoUpload ran
// in a browser (WebCodecs), with the poster it made.

describe('what an uploaded video is', () => {
  test('a phone clip is read the way it is shown, with its turn', async () => {
    const clip = await inspectVideo(await bytesOf('portrait-phone.mov'))
    expect(clip).toMatchObject({ format: 'mov', videoCodec: 'h265', audioCodec: 'aac', hasAudio: true, width: 360, height: 640, rotation: 90 })
    expect(clip!.frameRate).toBeCloseTo(60, 0)
    expect(clip!.duration).toBeCloseTo(1, 1)
  })

  test('a clip prepared in the browser is upright H.264 and AAC at 30 frames, index first', async () => {
    const bytes = await bytesOf('portrait-prepared.mp4')
    const clip = await inspectVideo(bytes)
    expect(clip).toMatchObject({ format: 'mp4', videoCodec: 'h264', audioCodec: 'aac', hasAudio: true, width: 360, height: 640, rotation: 0 })
    expect(clip!.frameRate).toBeCloseTo(30, 0)
    expect(clip!.duration).toBeCloseTo(1, 1)
    expect(isFaststart(bytes)).toBe(true)
    expect(webReadyProblems(clip!, true)).toEqual([])
  })

  test('the original is told apart from a prepared clip, whatever it claims', async () => {
    const bytes = await bytesOf('portrait-phone.mov')
    const clip = await inspectVideo(bytes)
    expect(isFaststart(bytes)).toBe(false)
    expect(webReadyProblems(clip!, isFaststart(bytes))).toEqual(['container mov', 'video h265', 'not faststart'])
  })

  test('the box is checked either way up', () => {
    const ready = { format: 'mp4', videoCodec: 'h264' as const, audioCodec: 'aac' as const, hasAudio: true }
    expect(webReadyProblems({ ...ready, width: 1280, height: 720 }, true)).toEqual([])
    expect(webReadyProblems({ ...ready, width: 720, height: 1280 }, true)).toEqual([])
    expect(webReadyProblems({ ...ready, width: 1920, height: 1080 }, true)).toEqual(['size 1920x1080'])
    expect(webReadyProblems({ ...ready, width: 1920, height: 1080 }, true, { maxLongEdge: 1920, maxShortEdge: 1080 })).toEqual([])
    expect(webReadyProblems({ ...ready, hasAudio: false, audioCodec: undefined, width: 640, height: 360 }, true)).toEqual([])
    expect(webReadyProblems({ ...ready, audioCodec: 'opus', width: 640, height: 360 }, true)).toEqual(['audio opus'])
  })

  test('faststart is read from the order of the top-level boxes', () => {
    const box = (type: string, size: number): Uint8Array => {
      const bytes = new Uint8Array(size)
      new DataView(bytes.buffer).setUint32(0, size)
      bytes.set([...type].map(letter => letter.charCodeAt(0)), 4)
      return bytes
    }
    const file = (...boxes: Uint8Array[]): Uint8Array => Uint8Array.from(boxes.flatMap(part => [...part]))
    expect(isFaststart(file(box('ftyp', 24), box('moov', 100), box('mdat', 50)))).toBe(true)
    expect(isFaststart(file(box('ftyp', 24), box('free', 8), box('mdat', 50), box('moov', 100)))).toBe(false)
    // Only the head of a large file: the media data runs past what was read.
    expect(isFaststart(file(box('ftyp', 24), box('moov', 100)).subarray(0, 60))).toBe(true)
    expect(isFaststart(new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 1, 2, 3, 4]))).toBe(false)
    expect(isFaststart(new Uint8Array(0))).toBe(false)
  })

  test('a file on disk is inspected without being read whole', async () => {
    const prepared = await inspectVideoFile(fixture('portrait-prepared.mp4'))
    expect(prepared).toMatchObject({ format: 'mp4', videoCodec: 'h264', faststart: true, width: 360, height: 640 })
    expect(prepared!.bytes).toBe(Bun.file(fixture('portrait-prepared.mp4')).size)
    expect(await inspectVideoFile(fixture('portrait-phone.mov'))).toMatchObject({ format: 'mov', faststart: false, rotation: 90 })
    expect(await inspectVideoFile(fixture('portrait-prepared.jpg'))).toBeNull()
    expect(await inspectVideoFile(fixture('missing.mp4'))).toBeNull()
  })
})

describe('preparing a clip where there are no codecs', () => {
  test('answers the original, untouched, and says why', async () => {
    // A server, or a browser without WebCodecs: the upload goes ahead with the file as picked.
    expect(canPrepareVideoUpload()).toBe(false)
    const file = new Blob([await bytesOf('portrait-phone.mov')], { type: 'video/quicktime' })
    const prepared = await prepareVideoUpload(file)
    expect(prepared.video).toBe(file)
    expect(prepared).toMatchObject({ converter: null, reason: 'unsupported', sourceBytes: file.size })
    expect(prepared.poster).toBeUndefined()
  })
})
