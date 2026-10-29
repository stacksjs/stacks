import { timingSafeEqual } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

export interface LocalSpeechOptions {
  /** A private service token, shared only with the calling application. */
  bearerToken: string
  modelPath: string
  executable?: string
  threads?: number
  maxBytes?: number
  maxConcurrent?: number
  timeoutMs?: number
  /** Another local engine can implement the same bounded WAV-to-text contract. */
  transcribe?: (audio: Uint8Array, signal: AbortSignal) => Promise<string>
}

/** Run whisper.cpp without retaining a recording, transcript, or command output. */
export function whisperTranscriber(options: Pick<LocalSpeechOptions, 'modelPath' | 'executable' | 'threads'>) {
  const executable = options.executable || 'whisper-cli'
  const model = resolve(options.modelPath)
  const threads = Math.max(1, Math.min(8, Math.floor(options.threads || 2)))
  return async (audio: Uint8Array, signal: AbortSignal): Promise<string> => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-'))
    try {
      const input = join(directory, 'recording.wav')
      const output = join(directory, 'transcript')
      await Bun.write(input, audio, { mode: 0o600 })
      if (signal.aborted) throw new Error('Transcription timed out')
      const child = Bun.spawn([executable, '--model', model, '--file', input, '--output-json', '--output-file', output, '--no-prints', '--language', 'auto', '--threads', String(threads), '--no-gpu'], { stdout: 'ignore', stderr: 'ignore', env: { PATH: process.env.PATH || '', LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || '', TMPDIR: tmpdir() } })
      const stop = () => child.kill('SIGKILL')
      signal.addEventListener('abort', stop, { once: true })
      if (signal.aborted) stop()
      let status: number
      try { status = await child.exited }
      finally { signal.removeEventListener('abort', stop) }
      if (signal.aborted) throw new Error('Transcription timed out')
      if (status !== 0) throw new Error('The local speech engine could not decode this recording')
      const result = await Bun.file(`${output}.json`).json()
      if (!Array.isArray(result.transcription)) throw new Error('The local speech engine returned no transcript')
      return result.transcription.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '').join('').trim()
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  }
}

/**
 * Authenticated, OpenAI-compatible local transcription for Bun.serve.
 * Bind the host to loopback and set maxRequestBodySize to maxBytes + 65536.
 * Reads are bounded here as well; uploads and inference are never queued without limit.
 */
export function createLocalSpeechHandler(options: LocalSpeechOptions): (request: Request) => Promise<Response> {
  if (options.bearerToken.length < 24) throw new Error('Local speech requires a private service token of at least 24 characters')
  const token = Buffer.from(`Bearer ${options.bearerToken}`)
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024
  const maxConcurrent = options.maxConcurrent ?? 1
  const timeoutMs = options.timeoutMs ?? 80_000
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 44 || !Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1 || !Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('Invalid local speech limits')
  const transcribe = options.transcribe ?? whisperTranscriber(options)
  let active = 0
  const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
  return async (request) => {
    const authorization = Buffer.from(request.headers.get('authorization') || '')
    if (authorization.length !== token.length || !timingSafeEqual(authorization, token)) return json({ error: { message: 'Unauthorized' } }, 401)
    const path = new URL(request.url).pathname
    if (path === '/health' && request.method === 'GET') return json({ ready: true, active, capacity: maxConcurrent })
    if (path !== '/v1/audio/transcriptions') return json({ error: { message: 'Not found' } }, 404)
    if (request.method !== 'POST') return json({ error: { message: 'Use POST' } }, 405, { Allow: 'POST' })
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) return json({ error: { message: 'Send multipart audio' } }, 415)
    if (active >= maxConcurrent) return json({ error: { message: 'The speech service is busy. Try again shortly.' } }, 503, { 'Retry-After': '3' })
    active++
    const controller = new AbortController()
    const abort = () => controller.abort()
    request.signal.addEventListener('abort', abort, { once: true })
    if (request.signal.aborted) abort()
    const timer = setTimeout(abort, timeoutMs)
    try {
      const reader = request.body?.getReader()
      if (!reader) return json({ error: { message: 'Send audio' } }, 422)
      const chunks: Uint8Array[] = []
      let size = 0
      const cancel = () => { void reader.cancel().catch(() => {}) }
      controller.signal.addEventListener('abort', cancel, { once: true })
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          size += chunk.value.length
          if (size > maxBytes + 65_536) { await reader.cancel(); return json({ error: { message: 'Recording is too large' } }, 413) }
          chunks.push(chunk.value)
        }
      }
      finally { controller.signal.removeEventListener('abort', cancel) }
      if (controller.signal.aborted) return json({ error: { message: 'Transcription timed out' } }, 504)
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      let form: FormData
      try { form = await new Request(request.url, { method: 'POST', headers: request.headers, body: bytes }).formData() }
      catch { return json({ error: { message: 'Invalid multipart audio' } }, 422) }
      const file = form.get('file')
      if (!(file instanceof Blob) || file.size < 44) return json({ error: { message: 'Send a WAV recording as file' } }, 422)
      if (file.size > maxBytes) return json({ error: { message: 'Recording is too large' } }, 413)
      const audio = new Uint8Array(await file.arrayBuffer())
      if (String.fromCharCode(...audio.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...audio.slice(8, 12)) !== 'WAVE') return json({ error: { message: 'Send decoded WAV audio' } }, 422)
      if (form.get('response_format') && form.get('response_format') !== 'json') return json({ error: { message: 'Use JSON response format' } }, 422)
      const text = (await transcribe(audio, controller.signal)).trim()
      if (controller.signal.aborted) return json({ error: { message: 'Transcription timed out' } }, 504)
      if (!text || text.length > 16_000) return json({ error: { message: 'No usable speech was detected' } }, 422)
      return json({ text })
    }
    catch { return json({ error: { message: controller.signal.aborted ? 'Transcription timed out' : 'The recording could not be transcribed' } }, controller.signal.aborted ? 504 : 422) }
    finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); active-- }
  }
}
