import { describe, expect, test } from 'bun:test'
import { assertAudioPlanExecutable, audio, createWaveform, negotiateAudioOutput, normalizeTranscript } from '../src'
const profile = { codec: 'flac', container: 'flac', duration: 60, sampleRate: 48000, channels: 2, bitrate: 800000 }
describe('@stacksjs/audio', () => {
  test('reports unavailable encoding honestly', () => { const plan = audio('episode.flac').profile(profile).content('speech').generate(); expect(plan.outputs.every(value => value.action === 'transcode' && !value.available)).toBe(true); expect(() => assertAudioPlanExecutable(plan)).toThrow(/unavailable/) })
  test('negotiates formats by q-value', () => { const plan = audio('episode.flac').profile(profile).runtime({ encoder: true, codecs: ['opus', 'aac', 'mp3'] }).generate(); expect(negotiateAudioOutput(plan.outputs, 'audio/mpeg;q=.5,audio/ogg;q=1')?.format).toBe('opus') })
  test('normalizes waveforms and transcripts', () => { expect(createWaveform([new Float32Array([-.5, .25, -1, .75])], 4, 2).peaks).toEqual([[-.5, .25, -1, .75]]); expect(normalizeTranscript('EN', [{ startTime: 0, endTime: 1.25, text: ' Hello ' }]).vtt).toContain('00:00:01.250') })
})
