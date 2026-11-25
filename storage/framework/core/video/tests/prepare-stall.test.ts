/**
 * A conversion that stops moving. On an iOS simulator (and a browser whose GPU
 * process wedged) a WebCodecs step can never settle: prepareVideoUpload used
 * to fall back to the original only when the encoder threw, so the upload
 * waited forever at 0%. It now gives up after `stallMs` without progress and
 * sends the original, and the caller's cancel wins over an encoder that never
 * answers.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

type Progress = (progress: { ratio: number }) => void
interface Call { signal: AbortSignal, onProgress: Progress }

/** What the fake encoder does with each call: set by the test. */
let behave: (call: Call) => Promise<unknown> = () => new Promise(() => {})
const calls: Call[] = []

mock.module('ts-videos/native-transcode', () => ({
  prepareVideoForUpload: (_file: Blob, options: { signal: AbortSignal, onProgress: Progress }) => {
    const call = { signal: options.signal, onProgress: options.onProgress }
    calls.push(call)
    return behave(call)
  },
}))

const CODECS = ['VideoDecoder', 'VideoEncoder', 'EncodedVideoChunk', 'VideoFrame', 'OffscreenCanvas']
const scope = globalThis as Record<string, unknown>
beforeAll(() => { for (const name of CODECS) scope[name] = function codec() {} })
afterAll(() => { for (const name of CODECS) delete scope[name] })

const { prepareVideoUpload, VideoPrepareStalledError } = await import('../src/browser')

const file = new Blob([new Uint8Array(64)], { type: 'video/mp4' })
const converted = { video: new Blob([new Uint8Array(8)], { type: 'video/mp4' }), poster: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }), width: 1280, height: 720, duration: 8 }
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('a conversion that stops moving', () => {
  test('sends the original once it has not moved for stallMs, and stops the encoder', async () => {
    calls.length = 0
    behave = () => new Promise(() => {})
    const started = Date.now()
    const prepared = await prepareVideoUpload(file, { stallMs: 40, firstTickMs: 40 })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(prepared.video).toBe(file)
    expect(prepared).toMatchObject({ converter: null, reason: 'stalled' })
    expect(prepared.cause).toBeInstanceOf(VideoPrepareStalledError)
    expect(calls[0]!.signal.aborted).toBe(true)
  })

  test('waits as long as it keeps moving: each tick starts the wait again', async () => {
    const ratios: number[] = []
    behave = async ({ onProgress }) => {
      for (const ratio of [0.2, 0.4, 0.6, 0.8, 1]) {
        await wait(25)
        onProgress({ ratio })
      }
      return converted
    }
    // 125 ms in all, never more than 25 between ticks.
    const prepared = await prepareVideoUpload(file, { stallMs: 60, firstTickMs: 60, onProgress: ratio => ratios.push(ratio) })
    expect(prepared).toMatchObject({ converter: 'webcodecs', width: 1280, height: 720 })
    expect(prepared.video).toBe(converted.video)
    expect(ratios).toEqual([0.2, 0.4, 0.6, 0.8, 1])
  })

  test('counts the wait before the first tick too, against its own longer budget', async () => {
    behave = async ({ onProgress }) => {
      await wait(120)
      onProgress({ ratio: 0.5 })
      await wait(10)
      return converted
    }
    // Reading the clip's index comes before any tick: allowed longer than a gap between ticks.
    expect((await prepareVideoUpload(file, { stallMs: 40, firstTickMs: 400 })).converter).toBe('webcodecs')
    expect((await prepareVideoUpload(file, { stallMs: 40, firstTickMs: 40 })).reason).toBe('stalled')
  })

  test('gives a clip by default a minute and more before its first tick', async () => {
    behave = () => new Promise(() => {})
    const controller = new AbortController()
    let outcome = 'pending'
    void prepareVideoUpload(file, { stallMs: 20, signal: controller.signal }).then(() => { outcome = 'answered' }, () => { outcome = 'cancelled' })
    await wait(150)
    expect(outcome).toBe('pending')
    controller.abort()
    await wait(0)
    expect(outcome).toBe('cancelled')
  })

  test('says nothing more once it has answered: a given-up encoder\'s late ticks are dropped', async () => {
    let late: Progress | undefined
    behave = ({ onProgress }) => {
      late = onProgress
      return new Promise(() => {})
    }
    const ratios: number[] = []
    const prepared = await prepareVideoUpload(file, { stallMs: 30, firstTickMs: 30, onProgress: ratio => ratios.push(ratio) })
    expect(prepared.reason).toBe('stalled')
    late!({ ratio: 0.9 })
    expect(ratios).toEqual([])
  })

  test('waits while the page is hidden, and starts the wait again when it is seen', async () => {
    const page = Object.assign(new EventTarget(), { hidden: true })
    scope.document = page
    try {
      behave = () => new Promise(() => {})
      let outcome: string | undefined
      void prepareVideoUpload(file, { stallMs: 30, firstTickMs: 30 }).then(prepared => { outcome = prepared.reason })
      await wait(120)
      expect(outcome).toBeUndefined()
      page.hidden = false
      page.dispatchEvent(new Event('visibilitychange'))
      await wait(80)
      expect(outcome).toBe('stalled')
    }
    finally {
      delete scope.document
    }
  })

  test('lets a cancel through at once, though the encoder never answers', async () => {
    calls.length = 0
    behave = () => new Promise(() => {})
    const controller = new AbortController()
    const pending = prepareVideoUpload(file, { stallMs: 10_000, firstTickMs: 10_000, signal: controller.signal })
    await wait(10)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls[0]!.signal.aborted).toBe(true)
  })

  test('refuses at once when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(prepareVideoUpload(file, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  test('waits as long as it takes with stallMs 0', async () => {
    behave = async () => {
      await wait(60)
      return converted
    }
    expect((await prepareVideoUpload(file, { stallMs: 0 })).converter).toBe('webcodecs')
  })

  test('still sends the original, as failed, when the encoder throws', async () => {
    behave = async () => { throw new Error('VideoEncoder closed') }
    const prepared = await prepareVideoUpload(file, { stallMs: 1000 })
    expect(prepared).toMatchObject({ converter: null, reason: 'failed' })
    expect((prepared.cause as Error).message).toBe('VideoEncoder closed')
  })
})
