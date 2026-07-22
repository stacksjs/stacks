import { expect, mock, test } from 'bun:test'

mock.module('@ts-audio/core/native-transcode', () => ({
  generateAudioDerivatives: async (source: string, plan: { source: { codec: string }, outputs: unknown[] }): Promise<unknown[]> => {
    expect(source).toBe('episode.flac')
    expect(plan.source.codec).toBe('flac')
    expect(plan.outputs).toHaveLength(3)
    return [{ output: plan.outputs[0], bytes: new Uint8Array([4, 5, 6]) }]
  },
}))

const { audio } = await import('../src')

test('processes a generated audio plan through ts-audio', async () => {
  const result = await audio('episode.flac')
    .profile({ codec: 'flac', container: 'flac', duration: 60, sampleRate: 48_000, channels: 2 })
    .runtime({ encoder: true, codecs: ['opus', 'aac', 'mp3'] })
    .process()
  expect(result[0]?.bytes).toEqual(new Uint8Array([4, 5, 6]))
})
