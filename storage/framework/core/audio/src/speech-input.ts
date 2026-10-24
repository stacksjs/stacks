/** Decode untrusted voice uploads before billing or sending them to a speech provider. */
export interface SpeechAudioOptions {
  maxBytes?: number
  maxDurationSeconds?: number
  timeoutMs?: number
  signal?: AbortSignal
  /** Deployment-installed FFmpeg; never a path supplied by an HTTP caller. */
  decoderPath?: string
}

export interface PreparedSpeechAudio {
  audio: Uint8Array
  mimeType: 'audio/wav'
  durationSeconds: number
}

export async function prepareSpeechAudio(input: Uint8Array, options: SpeechAudioOptions = {}): Promise<PreparedSpeechAudio> {
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024
  const maxDuration = options.maxDurationSeconds ?? 300
  const timeout = options.timeoutMs ?? 30_000
  if (![maxBytes, maxDuration, timeout].every(value => Number.isSafeInteger(value) && value > 0) || maxDuration > 3600) throw new TypeError('Invalid speech audio limits')
  if (!input.length || input.length > maxBytes) throw new Error('Audio size exceeds the upload limit or is empty')
  options.signal?.throwIfAborted()
  const executable = options.decoderPath || Bun.which('ffmpeg')
  if (!executable) throw new Error('Speech audio preparation needs FFmpeg installed on the server')
  // No filenames, external protocols, playlists or shell interpolation. Decode
  // one second beyond the limit so a falsely short container header cannot pass.
  const child = Bun.spawn([executable, '-nostdin', '-hide_banner', '-v', 'error', '-threads', '1', '-protocol_whitelist', 'pipe', '-i', 'pipe:0', '-map', '0:a:0', '-vn', '-t', String(maxDuration + 1), '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'], { stdin: new Blob([new Uint8Array(input)]), stdout: 'pipe', stderr: 'pipe' })
  let timedOut = false
  const stop = () => { if (child.exitCode === null) child.kill('SIGKILL') }
  const timer = setTimeout(() => {
    timedOut = true
    stop()
  }, timeout)
  options.signal?.addEventListener('abort', stop, { once: true })
  async function bounded(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const item = await reader.read()
        if (item.done) break
        size += item.value.length
        if (size > limit) {
          stop()
          throw new Error('Audio decoder exceeded its output limit')
        }
        chunks.push(item.value)
      }
    }
    finally { reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    return bytes
  }
  try {
    const [audio, , code] = await Promise.all([bounded(child.stdout, (maxDuration + 1) * 32000 + 4096), bounded(child.stderr, 16_384), child.exited])
    options.signal?.throwIfAborted()
    if (timedOut) throw new Error('Audio decoder timed out')
    if (code !== 0 || audio.length < 44) throw new Error('The uploaded audio could not be decoded')
    const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength)
    for (let offset = 12; offset + 8 <= audio.length;) {
      const size = view.getUint32(offset + 4, true)
      if (String.fromCharCode(...audio.subarray(offset, offset + 4)) === 'data') {
        const durationSeconds = (audio.length - offset - 8) / 32000
        if (durationSeconds <= 0 || durationSeconds > maxDuration) throw new Error('Audio duration exceeds the recording limit or is empty')
        return { audio, mimeType: 'audio/wav', durationSeconds }
      }
      offset += 8 + size + (size % 2)
    }
    throw new Error('Audio decoder returned an invalid WAV container')
  }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', stop)
    stop()
  }
}
