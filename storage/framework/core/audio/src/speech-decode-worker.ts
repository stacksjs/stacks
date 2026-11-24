/**
 * The worker thread `prepareSpeechAudio` decodes in, so a long decode never
 * holds the server's event loop and a deadline or abort can stop it outright.
 * It says `ready` once loaded, which tells a worker that cannot load (a
 * bundled app, where this file is not beside its caller) from a decode that
 * failed; it then decodes one job and is terminated by its caller.
 */
import type { SpeechDecodeLimits } from './speech-decode'
import { decodeSpeech } from './speech-decode'

declare const self: Worker

export interface SpeechDecodeJob extends SpeechDecodeLimits {
  input: ArrayBuffer
}

self.onmessage = async ({ data }: MessageEvent<SpeechDecodeJob>) => {
  const result = await decodeSpeech(new Uint8Array(data.input), data).catch(error => ({ ok: false as const, failure: { kind: 'undecodable' as const, detail: error instanceof Error ? error.message : String(error) } }))
  if (result.ok) self.postMessage(result, [result.audio.buffer])
  else self.postMessage(result)
}

self.postMessage({ ready: true })
