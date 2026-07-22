import { describe, expect, test } from 'bun:test'
import { assertVideoPlanExecutable, createHlsMaster, createPreviewVtt, deriveVideoLadder, video } from '../src'
const profile = { width: 1920, height: 1080, duration: 120, frameRate: 30, container: 'mp4' as const, videoCodec: 'h264', audioCodec: 'aac', hasAudio: true }
describe('@stacksjs/video', () => {
  test('creates distinct ladders without upscaling', () => expect(deriveVideoLadder(profile).map(value => value.height)).toEqual([240, 360, 480, 540, 720, 1080]))
  test('fails early when encoders are unavailable', () => { const plan = video('demo.mp4').profile(profile).generate(); expect(plan.outputs[1]).toMatchObject({ action: 'transcode', available: false }); expect(() => assertVideoPlanExecutable(plan)).toThrow(/unavailable/) })
  test('emits HLS metadata and preview VTT', () => { const plan = video('demo.mp4').profile(profile).output(['mp4']).runtime({ videoEncoder: true, audioEncoder: true, videoCodecs: ['h264'], audioCodecs: ['aac'] }).generate(); expect(createHlsMaster(plan, item => `${item.name}.m3u8`)).toContain('RESOLUTION=1920x1080'); expect(createPreviewVtt([{ startTime: 0, endTime: 10, uri: 'sprite.jpg', x: 0, y: 0, width: 160, height: 90 }])).toContain('#xywh=0,0,160,90') })
})
