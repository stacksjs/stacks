import { expect, test } from 'bun:test'
import { createVoiceRecorder } from '../src/voice-recorder'

test('recording cancellation owns delayed permissions and releases every track', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const previousRecorder = globalThis.MediaRecorder
  let resolve!: (value: any) => void
  let stopped = 0
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(done => { resolve = done }) } } })
  globalThis.MediaRecorder = class {} as any
  try {
    const recorder = createVoiceRecorder()
    const pending = recorder.start()
    expect(recorder.snapshot().status).toBe('requesting')
    recorder.cancel()
    resolve({ getTracks: () => [{ stop: () => stopped++ }] })
    await pending
    expect(stopped).toBe(1)
    expect(recorder.snapshot()).toEqual({ status: 'idle', audio: null, error: null })
    recorder.dispose()
  }
  finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else Reflect.deleteProperty(globalThis, 'navigator')
    globalThis.MediaRecorder = previousRecorder
  }
})

test('a stopped recording is reviewable, bounded, and erased on dispose', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const previousRecorder = globalThis.MediaRecorder
  let stopped = 0
  let active: any
  class Recorder {
    static isTypeSupported() { return true }
    state = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: any
    onstop: any
    constructor() { active = this }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.onstop() }
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) } } })
  globalThis.MediaRecorder = Recorder as any
  try {
    const recorder = createVoiceRecorder({ maxBytes: 4 })
    await recorder.start()
    active.ondataavailable({ data: new Blob(['yes']) })
    recorder.stop()
    expect(await recorder.snapshot().audio!.text()).toBe('yes')
    expect(stopped).toBe(1)
    await recorder.start()
    active.ondataavailable({ data: new Blob(['too large']) })
    expect(recorder.snapshot().status).toBe('error')
    expect(recorder.snapshot().audio).toBeNull()
    expect(stopped).toBe(2)
    recorder.dispose()
    expect(recorder.snapshot().audio).toBeNull()
  }
  finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else Reflect.deleteProperty(globalThis, 'navigator')
    globalThis.MediaRecorder = previousRecorder
  }
})
