import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface LocalSpeechModel {
  filename: string
  url: string
  sha256: string
  bytes: number
}

/** Immutable multilingual Whisper base model used by the private CPU runtime. */
export const MULTILINGUAL_BASE_SPEECH_MODEL: Readonly<LocalSpeechModel> = Object.freeze({
  filename: 'ggml-base.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin',
  sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  bytes: 147951465,
})

export interface LocalSpeechModelOptions {
  directory: string
  model?: Readonly<LocalSpeechModel>
  timeoutMs?: number
  attempts?: number
  signal?: AbortSignal
}

async function verified(path: string, model: Readonly<LocalSpeechModel>): Promise<boolean> {
  try {
    if ((await stat(path)).size !== model.bytes) return false
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex') === model.sha256.toLowerCase()
}

/** Publish a bounded, checksum-verified model atomically; callers own the models directory. */
export async function ensureLocalSpeechModel(options: LocalSpeechModelOptions): Promise<string> {
  const model = options.model ?? MULTILINGUAL_BASE_SPEECH_MODEL
  const timeoutMs = options.timeoutMs ?? 180_000
  const attempts = options.attempts ?? 4
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(model.filename)
    || !/^[a-f0-9]{64}$/i.test(model.sha256)
    || !Number.isSafeInteger(model.bytes) || model.bytes <= 0)
    throw new TypeError('A speech model needs a safe filename, SHA-256 and positive byte length')
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
    throw new RangeError('timeoutMs must fit the platform timer range')
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10)
    throw new RangeError('attempts must be between one and ten')
  options.signal?.throwIfAborted()
  await mkdir(options.directory, { recursive: true, mode: 0o700 })
  const target = join(options.directory, model.filename)
  if (await verified(target, model)) return target
  const partial = join(options.directory, `.${model.filename}.${randomUUID()}.partial`)
  let failure: unknown
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      options.signal?.throwIfAborted()
      let reset = false
      try {
        let received = await stat(partial).then(file => file.size, (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return 0
          throw error
        })
        if (received === model.bytes) {
          if (await verified(partial, model)) {
            await rename(partial, target)
            return target
          }
          await rm(partial, { force: true })
          received = 0
        }
        const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
        const headers: Record<string, string> = { 'Accept-Encoding': 'identity' }
        if (received) headers.Range = `bytes=${received}-`
        const response = await fetch(model.url, { signal, headers })
        if (![200, 206].includes(response.status) || !response.body) {
          await response.body?.cancel()
          throw new Error(`Speech model download failed (HTTP ${response.status})`)
        }
        if (response.status === 206) {
          const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '')
          if (!range || Number(range[1]) !== received || Number(range[3]) !== model.bytes
            || Number(range[2]) < received || Number(range[2]) >= model.bytes) {
            await response.body.cancel()
            throw new Error('Speech model response did not match the requested byte range')
          }
        }
        else received = 0 // An origin that ignores Range restarts the representation.
        const file = await open(partial, response.status === 206 ? 'a' : 'w', 0o600)
        const reader = response.body.getReader()
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            received += value.length
            if (received > model.bytes) {
              reset = true
              throw new Error('Speech model exceeded its pinned byte length')
            }
            await file.writeFile(value)
          }
        }
        finally { await reader.cancel().catch(() => {}); await file.close() }
        if (received !== model.bytes) throw new Error('Speech model response ended before its pinned byte length')
        if (!await verified(partial, model)) {
          reset = true
          throw new Error('Speech model did not match its pinned SHA-256')
        }
        await rename(partial, target)
        return target
      }
      catch (error) {
        failure = error
        options.signal?.throwIfAborted()
        if (reset) await rm(partial, { force: true })
        if (attempt + 1 < attempts) await Bun.sleep(Math.min(250 * 2 ** attempt, 2000))
      }
    }
    throw new Error(`Speech model could not be verified after ${attempts} download attempts`, { cause: failure })
  }
  finally { await rm(partial, { force: true }) }
}
