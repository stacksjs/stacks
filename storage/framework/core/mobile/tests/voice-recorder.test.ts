import { NativeFormData } from '@stacksjs/stx/native/runtime/jsc-globals'
import { expect, test } from 'bun:test'
import { createVoiceRecorder, voiceRecordingFormData } from '../src/voice-recorder'

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

test('native recordings keep their file until upload and cancel by owner after account changes', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const cancelled: string[] = []
  let owner = ''
  let release!: () => void
  let pending = false
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { craft: { audioRecording: {
    start: async (key: string) => { owner = key; if (pending) await new Promise<void>(resolve => { release = resolve }); return true },
    stop: async (key: string) => { expect(key).toBe(owner); return { path: '/private/voice.m4a', name: 'voice.m4a', type: 'audio/mp4', size: 300, durationSeconds: 2 } },
    cancel: async (key: string) => { cancelled.push(key); return true },
  } } } })
  try {
    const recorder = createVoiceRecorder()
    expect(recorder.supported()).toBe(true)
    await recorder.start()
    await recorder.stop()
    expect(recorder.snapshot().status).toBe('ready')
    expect(recorder.snapshot().audio).toMatchObject({ path: '/private/voice.m4a' })
    recorder.cancel()
    expect(cancelled).toEqual([owner])
    pending = true
    const starting = recorder.start()
    recorder.cancel()
    release()
    await starting
    expect(recorder.snapshot().status).toBe('idle')
    expect(cancelled).toHaveLength(2)
    recorder.dispose()
  }
  finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('recording uploads preserve browser blobs and reject native descriptors on a browser host', async () => {
  const audio = new Blob(['recorded'], { type: 'audio/wav' })
  const form = voiceRecordingFormData(audio, { client_key: 'voice-request' })
  expect(await (form.get('audio') as File).text()).toBe('recorded')
  expect(form.get('client_key')).toBe('voice-request')
  expect(() => voiceRecordingFormData({ path: '/private/voice.m4a', name: 'voice.m4a', type: 'audio/mp4', size: 300, durationSeconds: 2 })).toThrow('native upload host')
})

test('recording uploads use the actual native FormData file contract', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousForm = Object.getOwnPropertyDescriptor(globalThis, 'FormData')
  const audio = { path: '/private/voice.m4a', name: 'voice.m4a', type: 'audio/mp4', size: 300, durationSeconds: 2 }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { craft: { audioRecording: { stop: async () => audio } } } })
  try {
    expect(() => voiceRecordingFormData(audio)).toThrow('did not preserve')
    Object.defineProperty(globalThis, 'FormData', { configurable: true, value: NativeFormData })
    const form = voiceRecordingFormData(audio, { product_id: '2' })
    expect(form.get('audio')).toMatchObject({ path: audio.path, type: 'audio/mp4' })
    expect(form.get('product_id')).toBe('2')
  }
  finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousForm) Object.defineProperty(globalThis, 'FormData', previousForm)
  }
})
