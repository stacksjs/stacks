import { nativeFunctionNow } from './bridge'
/** A bounded, disposable microphone session. Audio is never persisted by this helper. */
export interface VoiceRecorderOptions { maxSeconds?: number, maxBytes?: number }
export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'ready' | 'error'
export interface NativeVoiceFile { path: string, name: string, type: string, size: number, durationSeconds: number }
export interface VoiceRecorderSnapshot { status: VoiceRecorderStatus, audio: Blob | NativeVoiceFile | null, error: string | null }

/** Stable public contract shared by browser and native recording hosts. */
export interface VoiceRecorder {
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => void
  dispose: () => void
  supported: () => boolean
  snapshot: () => VoiceRecorderSnapshot
  subscribe: (listener: (value: VoiceRecorderSnapshot) => void) => () => void
}

export function createVoiceRecorder(options: VoiceRecorderOptions = {}): VoiceRecorder {
  const maxSeconds = options.maxSeconds ?? 300
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024
  if (![maxSeconds, maxBytes].every(value => Number.isSafeInteger(value) && value > 0) || maxSeconds > 300) throw new TypeError('Invalid voice recording limits')
  let snapshot: VoiceRecorderSnapshot = { status: 'idle', audio: null, error: null }
  const listeners = new Set<(value: VoiceRecorderSnapshot) => void>()
  let owner: object = {}
  let nativeOwner: string | null = null
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const publish = (value: VoiceRecorderSnapshot) => { snapshot = value; for (const listener of listeners) listener({ ...value }) }
  const stopTracks = () => { clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); stream = null }
  function cancel() {
    owner = {}
    if (nativeOwner) {
      const key = nativeOwner
      nativeOwner = null
      void Promise.resolve(nativeFunctionNow('audioRecording.cancel')?.(key)).catch(() => {})
    }
    const previous = recorder
    recorder = null
    if (previous && previous.state !== 'inactive') previous.stop()
    stopTracks()
    publish({ status: 'idle', audio: null, error: null })
  }
  async function start() {
    cancel()
    const mine = owner
    publish({ status: 'requesting', audio: null, error: null })
    try {
      const startNative = nativeFunctionNow('audioRecording.start')
      if (startNative) {
        const key = globalThis.crypto.randomUUID()
        nativeOwner = key
        await startNative(key, { maxSeconds })
        if (owner !== mine) return
        timer = setTimeout(() => { if (owner === mine) void stop() }, maxSeconds * 1000 - 250)
        publish({ status: 'recording', audio: null, error: null })
        return
      }
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording is unavailable. Upload an audio recording instead.')
      const input = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false })
      if (owner !== mine) { input.getTracks().forEach(track => track.stop()); return }
      stream = input
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
      const current = new MediaRecorder(input, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 })
      recorder = current
      const chunks: Blob[] = []
      let size = 0
      let tooLarge = false
      current.ondataavailable = event => {
        if (owner !== mine || !event.data.size) return
        size += event.data.size
        if (size > maxBytes) { tooLarge = true; chunks.length = 0; if (current.state !== 'inactive') current.stop(); stopTracks(); return }
        if (!tooLarge) chunks.push(event.data)
      }
      current.onerror = () => {
        if (owner !== mine) return
        cancel()
        publish({ status: 'error', audio: null, error: 'Recording failed. Please try again.' })
      }
      current.onstop = () => {
        if (owner !== mine) return
        recorder = null
        stopTracks()
        const audio = new Blob(chunks, { type: current.mimeType || mimeType || 'audio/webm' })
        publish(tooLarge || !audio.size ? { status: 'error', audio: null, error: tooLarge ? 'The recording exceeds the upload limit.' : 'The recording was empty.' } : { status: 'ready', audio, error: null })
      }
      current.start(1000)
      timer = setTimeout(() => { if (owner === mine && current.state !== 'inactive') current.stop() }, maxSeconds * 1000 - 250)
      publish({ status: 'recording', audio: null, error: null })
    }
    catch (error) {
      if (owner !== mine) return
      cancel()
      publish({ status: 'error', audio: null, error: error instanceof Error ? error.message : 'Microphone permission was refused.' })
    }
  }
  async function stop() {
    if (!nativeOwner) { if (recorder && recorder.state !== 'inactive') recorder.stop(); return }
    const mine = owner
    const key = nativeOwner
    clearTimeout(timer)
    try {
      const audio = await nativeFunctionNow('audioRecording.stop')?.(key) as NativeVoiceFile | undefined
      if (owner !== mine) return
      if (!audio?.path || !audio.size || audio.size > maxBytes || !Number.isFinite(audio.durationSeconds) || audio.durationSeconds <= 0 || audio.durationSeconds > maxSeconds + 1) throw new Error('The recording is empty or exceeds its limits.')
      publish({ status: 'ready', audio, error: null })
    }
    catch (error) {
      if (owner !== mine) return
      cancel()
      publish({ status: 'error', audio: null, error: error instanceof Error ? error.message : 'Recording failed.' })
    }
  }
  return {
    start, cancel, dispose() { cancel(); listeners.clear() },
    stop,
    supported: () => Boolean(nativeFunctionNow('audioRecording.start')) || typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined',
    snapshot: () => ({ ...snapshot }),
    subscribe(listener: (value: VoiceRecorderSnapshot) => void) { listeners.add(listener); listener({ ...snapshot }); return () => { listeners.delete(listener) } },
  }
}

/** Build an upload using the host's real FormData; native recordings remain file descriptors. */
export function voiceRecordingFormData(audio: Blob | NativeVoiceFile, fields: Record<string, string> = {}, name = 'audio'): FormData {
  if (!name || Object.hasOwn(fields, name)) throw new TypeError('Use a distinct recording field name')
  const form = new FormData()
  if (typeof Blob !== 'undefined' && audio instanceof Blob) form.append(name, audio, 'feedback')
  else {
    if (!audio || !('path' in audio) || typeof audio.path !== 'string' || !audio.path || !nativeFunctionNow('audioRecording.stop')) throw new TypeError('A native recording requires its native upload host')
    // STX's native FormData accepts NativeFile, while the DOM overload accepts
    // Blob. Invoke the native contract without pretending a file is a Blob.
    Reflect.apply(form.append, form, [name, audio])
    const stored = form.get(name)
    if (!stored || typeof stored !== 'object' || !('path' in stored) || stored.path !== audio.path) throw new TypeError('The upload host did not preserve the native recording file')
  }
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== 'string') throw new TypeError('Upload fields must be strings')
    form.append(field, value)
  }
  return form
}
