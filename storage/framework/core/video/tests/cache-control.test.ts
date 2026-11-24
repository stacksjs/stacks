import { describe, expect, test } from 'bun:test'
import { videoAssetHeaders, videoFileResponse } from '../src'

// A protected video file was sent `public, max-age=31536000, immutable`, since
// protectedMedia only changed manifests. Behind a CDN that stores public
// responses, the file then sat at the edge, served to anyone without the
// app's access check, and a `Range: bytes=0-1` probe came back 200 with the
// whole file, which iOS Safari refuses to play. Protected media is now cached
// by the browser only, and the caller can name its own Cache-Control.

const clip = new Blob([new Uint8Array(1000)], { type: 'video/mp4' })

describe('Cache-Control for video files', () => {
  test('protected media is private: the browser caches it, a shared cache does not', () => {
    expect(videoAssetHeaders('clip.mp4', 10, undefined, true)['Cache-Control']).toBe('private, max-age=31536000, immutable')
    expect(videoAssetHeaders('seg-1.m4s', 10, undefined, true)['Cache-Control']).toBe('private, max-age=31536000, immutable')
    const ranged = videoFileResponse(clip, 'clip.mp4', { range: 'bytes=0-1', protectedMedia: true })
    expect(ranged.status).toBe(206)
    expect(ranged.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable')
  })

  test('unprotected media and manifests keep their caching', () => {
    expect(videoAssetHeaders('clip.mp4')['Cache-Control']).toBe('public, max-age=31536000, immutable')
    expect(videoAssetHeaders('master.m3u8')['Cache-Control']).toBe('public, max-age=5, s-maxage=30')
    expect(videoAssetHeaders('master.m3u8', undefined, undefined, true)['Cache-Control']).toBe('private, no-store')
  })

  test('a caller can name its own Cache-Control', () => {
    expect(videoAssetHeaders('clip.mp4', 10, undefined, false, 'no-cache')['Cache-Control']).toBe('no-cache')
    const full = videoFileResponse(clip, 'clip.mp4', { cacheControl: 'private, max-age=60' })
    expect(full.status).toBe(200)
    expect(full.headers.get('Cache-Control')).toBe('private, max-age=60')
  })
})
