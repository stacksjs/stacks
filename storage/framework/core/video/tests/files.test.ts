import { describe, expect, test } from 'bun:test'
import { inspectVideo, parseByteRange, videoContentType, videoFileResponse } from '../src'

describe('serving a video file', () => {
  test('reads Range headers the way players send them', () => {
    expect(parseByteRange('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 })
    expect(parseByteRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
    expect(parseByteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseByteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseByteRange('bytes=1000-', 1000)).toBe('unsatisfiable')
    expect(parseByteRange(null, 1000)).toBeNull()
    expect(parseByteRange('items=0-1', 1000)).toBeNull()
  })

  test('answers iOS\'s first 2-byte probe with a 206, and past the end with a 416', async () => {
    const file = new Blob([new Uint8Array(1000).fill(7)])
    const probe = videoFileResponse(file, 'clip.mov', { range: 'bytes=0-1', etag: 'abc' })
    expect(probe.status).toBe(206)
    expect(probe.headers.get('content-range')).toBe('bytes 0-1/1000')
    expect(probe.headers.get('content-length')).toBe('2')
    expect(probe.headers.get('content-type')).toBe('video/quicktime')
    expect(probe.headers.get('etag')).toBe('"abc"')
    expect((await probe.arrayBuffer()).byteLength).toBe(2)

    const whole = videoFileResponse(file, 'clip.mp4')
    expect(whole.status).toBe(200)
    expect(whole.headers.get('accept-ranges')).toBe('bytes')
    expect(whole.headers.get('content-length')).toBe('1000')

    expect(videoFileResponse(file, 'clip.mp4', { range: 'bytes=2000-' }).status).toBe(416)
    expect(videoContentType('stream.m3u8?token=1')).toBe('application/vnd.apple.mpegurl')
  })
})

describe('inspectVideo', () => {
  test('reads a phone\'s QuickTime clip', async () => {
    const bytes = new Uint8Array(await Bun.file(new URL('./fixtures/phone-clip.mov', import.meta.url)).arrayBuffer())
    const profile = await inspectVideo(bytes)
    expect(profile).toMatchObject({ format: 'mov', container: 'mp4', width: 1206, height: 2622, videoCodec: 'h264' })
    expect(profile!.duration).toBeGreaterThan(1)
    expect(profile!.frameRate).toBeGreaterThan(0)
  })

  test('finds nothing in a file that is not a video', async () => {
    expect(await inspectVideo(new TextEncoder().encode('just some notes'))).toBeNull()
  })
})
