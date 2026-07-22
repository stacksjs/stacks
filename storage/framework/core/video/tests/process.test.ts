import { expect, mock, test } from 'bun:test'

mock.module('ts-videos/delivery-pipeline', () => ({
  createVideoDeliveryPipeline: async (source: string, plan: { source: { width: number }, renditions: unknown[] }): Promise<unknown> => {
    expect(source).toBe('movie.mp4')
    expect(plan.source.width).toBe(1920)
    expect(plan.renditions.length).toBeGreaterThan(1)
    return {
      derivatives: [{ output: { container: 'mp4' }, rendition: plan.renditions[0], bytes: new Uint8Array([1, 2, 3]) }],
      files: { 'video/1080p.mp4': new Uint8Array([1, 2, 3]) },
    }
  },
}))

const { video } = await import('../src')

test('processes a generated video plan through ts-videos', async () => {
  const result = await video('movie.mp4')
    .profile({ width: 1920, height: 1080, duration: 60, frameRate: 30, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac' })
    .output(['mp4'])
    .runtime({ videoEncoder: true, audioEncoder: true, videoCodecs: ['h264'], audioCodecs: ['aac'] })
    .process()
  expect(result.derivatives[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]))
  expect(result.files['video/1080p.mp4']).toEqual(new Uint8Array([1, 2, 3]))
})
