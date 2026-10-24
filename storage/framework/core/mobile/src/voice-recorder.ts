/** A bounded, disposable microphone session. Audio is never persisted by this helper. */
export interface VoiceRecorderOptions { maxSeconds?: number, maxBytes?: number }
export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'ready' | 'error'
export interface VoiceRecorderSnapshot { status: VoiceRecorderStatus, audio: Blob | null, error: string | null }

export function createVoiceRecorder(options: VoiceRecorderOptions = {}) {
  const maxSeconds = options.maxSeconds ?? 300
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024
  if (![maxSeconds, maxBytes].every(value => Number.isSafeInteger(value) && value > 0) || maxSeconds > 300) throw new TypeError('Invalid voice recording limits')
  let snapshot: VoiceRecorderSnapshot = { status: 'idle', audio: null, error: null }
  const listeners = new Set<(value: VoiceRecorderSnapshot) => void>()
  let owner: object = {}
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const publish = (value: VoiceRecorderSnapshot) => { snapshot = value; for (const listener of listeners) listener({ ...value }) }
  const stopTracks = () => { clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); stream = null }
  function cancel() {
    owner = {}
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
      timer = setTimeout(() => { if (owner === mine && current.state !== 'inactive') current.stop() }, maxSeconds * 1000)
      publish({ status: 'recording', audio: null, error: null })
    }
    catch (error) {
      if (owner !== mine) return
      stopTracks()
      publish({ status: 'error', audio: null, error: error instanceof Error ? error.message : 'Microphone permission was refused.' })
    }
  }
  return {
    start, cancel, dispose() { cancel(); listeners.clear() },
    stop() { if (recorder && recorder.state !== 'inactive') recorder.stop() },
    supported: () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined',
    snapshot: () => ({ ...snapshot }),
    subscribe(listener: (value: VoiceRecorderSnapshot) => void) { listeners.add(listener); listener({ ...snapshot }); return () => { listeners.delete(listener) } },
  }
}
