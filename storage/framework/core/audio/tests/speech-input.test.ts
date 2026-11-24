import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { prepareSpeechAudio } from '../src/speech-input'

const fixtures = `${import.meta.dir}/fixtures/`

async function fixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await Bun.file(fixtures + name).arrayBuffer())
}

const ascii = (value: string): Uint8Array => new TextEncoder().encode(value)

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** A 16-bit PCM WAV: silence, or a 440 Hz tone at half scale. */
function wav(seconds: number, { rate = 16000, channels = 1, tone = false, format = 1, bits = 16 } = {}): Uint8Array {
  const frames = Math.round(seconds * rate)
  const size = frames * channels * bits / 8
  const bytes = new Uint8Array(44 + size)
  const view = new DataView(bytes.buffer)
  bytes.set(ascii('RIFF'), 0)
  view.setUint32(4, 36 + size, true)
  bytes.set(ascii('WAVEfmt '), 8)
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, rate >>> 0, true)
  view.setUint32(28, (rate * channels * bits / 8) >>> 0, true)
  view.setUint16(32, channels * bits / 8, true)
  view.setUint16(34, bits, true)
  bytes.set(ascii('data'), 36)
  view.setUint32(40, size, true)
  if (tone && bits === 16) {
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < channels; channel++)
        view.setInt16(44 + (frame * channels + channel) * 2, Math.round(Math.sin(2 * Math.PI * 440 * frame / rate) * 16384), true)
    }
  }
  return bytes
}

/** What the speech provider receives: the WAV header's fields and the loudest sample. */
function readWav(bytes: Uint8Array): { format: number, channels: number, rate: number, bits: number, frames: number, peak: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  expect(String.fromCharCode(...bytes.subarray(0, 4), ...bytes.subarray(8, 16))).toBe('RIFFWAVEfmt ')
  expect(String.fromCharCode(...bytes.subarray(36, 40))).toBe('data')
  const size = view.getUint32(40, true)
  expect(44 + size).toBe(bytes.length)
  let peak = 0
  for (let offset = 44; offset < bytes.length; offset += 2) peak = Math.max(peak, Math.abs(view.getInt16(offset, true)) / 32768)
  return { format: view.getUint16(20, true), channels: view.getUint16(22, true), rate: view.getUint32(24, true), bits: view.getUint16(34, true), frames: size / 2, peak }
}

/** An Ogg file's pages, whole. */
function oggPages(bytes: Uint8Array): Uint8Array[] {
  const pages: Uint8Array[] = []
  for (let offset = 0; offset + 27 <= bytes.length;) {
    const segments = bytes[offset + 26]!
    let size = 27 + segments
    for (let index = 0; index < segments; index++) size += bytes[offset + 27 + index]!
    pages.push(bytes.slice(offset, offset + size))
    offset += size
  }
  return pages
}

/** A page of 255 empty packets: each is a lost packet, which an Opus decoder conceals as 20 ms. */
function emptyPacketPage(serial: number, granule: number): Uint8Array {
  const page = new Uint8Array(27 + 255)
  const view = new DataView(page.buffer)
  page.set(ascii('OggS'), 0)
  view.setBigInt64(6, BigInt(granule), true)
  view.setUint32(14, serial, true)
  page[26] = 255
  return page
}

function oggPage(packet: Uint8Array): Uint8Array {
  const page = new Uint8Array(28 + packet.length)
  page.set(ascii('OggS'), 0)
  page[5] = 2
  page[26] = 1
  page[27] = packet.length
  page.set(packet, 28)
  return page
}

test('speech audio is decoded to bounded mono PCM, never trusting an uploaded duration', async () => {
  const result = await prepareSpeechAudio(wav(1), { maxDurationSeconds: 2 })
  expect(result.durationSeconds).toBe(1)
  expect(result.mimeType).toBe('audio/wav')
  expect(result.audio.length).toBeGreaterThan(32000)
  await expect(prepareSpeechAudio(wav(3), { maxDurationSeconds: 2 })).rejects.toThrow('duration')
  await expect(prepareSpeechAudio(wav(4), { maxDurationSeconds: 2 })).rejects.toThrow('duration')
  await expect(prepareSpeechAudio(ascii('not audio'))).rejects.toThrow('audio')
  await expect(prepareSpeechAudio(wav(1), { maxBytes: 100 })).rejects.toThrow('size')
  await expect(prepareSpeechAudio(new Uint8Array())).rejects.toThrow('size')
})

describe('recordings from phones and browsers decode to 16 kHz mono WAV', () => {
  const cases: Array<[string, string, () => Promise<Uint8Array>, number]> = [
    ['the phone app and Safari', 'AAC-LC in M4A', () => fixture('voice-aac-lc.m4a'), 0.83],
    ['WhatsApp and Firefox', 'SILK Opus in Ogg', () => fixture('voice-opus-silk.opus'), 0.83],
    ['Chrome', 'CELT Opus in WebM', () => fixture('voice-opus-celt.webm'), 0.83],
    ['a plain upload', '22.05 kHz stereo WAV', async () => wav(1, { rate: 22050, channels: 2, tone: true }), 1],
  ]
  for (const [source, format, load, seconds] of cases) {
    test(`${format}, as ${source} records`, async () => {
      const prepared = await prepareSpeechAudio(await load())
      const output = readWav(prepared.audio)
      expect(prepared.mimeType).toBe('audio/wav')
      expect({ format: output.format, channels: output.channels, rate: output.rate, bits: output.bits }).toEqual({ format: 1, channels: 1, rate: 16000, bits: 16 })
      expect(prepared.durationSeconds).toBe(output.frames / 16000)
      expect(prepared.durationSeconds).toBeCloseTo(seconds, 1)
      // Speech, not the silence a decoder that only parsed the container would give.
      expect(output.peak).toBeGreaterThan(0.1)
    })
  }
})

test('a recording that stops exactly at the limit is accepted', async () => {
  // The decoder sees the encoder's priming samples before trimming them, so
  // the limit applies to the decoded result, not to the decoder's progress.
  const phone = await prepareSpeechAudio(await fixture('voice.m4a'), { maxDurationSeconds: 60 })
  expect(phone.durationSeconds).toBeCloseTo(60, 1)
  expect((await prepareSpeechAudio(wav(2), { maxDurationSeconds: 2 })).durationSeconds).toBe(2)
})

test('over-long audio is refused from its decoded samples', async () => {
  await expect(prepareSpeechAudio(await fixture('voice.m4a'), { maxDurationSeconds: 30 })).rejects.toThrow('duration')
})

describe('an Ogg upload is measured by its packets, not its granule positions', () => {
  test('repeated audio under a granule that claims under a second', async () => {
    const pages = oggPages(await fixture('voice-opus-silk.opus'))
    // About 33 seconds of real packets. Every page keeps its original granule
    // position, so the last one still says the file ends after 0.8 seconds.
    const file = concat([pages[0]!, pages[1]!, ...Array.from({ length: 40 }, () => pages.slice(2)).flat()])
    await expect(prepareSpeechAudio(file, { maxDurationSeconds: 30 })).rejects.toThrow('duration')
    expect((await prepareSpeechAudio(file, { maxDurationSeconds: 60 })).durationSeconds).toBeLessThan(1)
  })

  test('empty packets, which decode to 20 ms each, are refused before decoding', async () => {
    const [head, tags] = oggPages(await fixture('voice-opus-silk.opus'))
    const serial = new DataView(head!.buffer).getUint32(14, true)
    // 56 KB that decodes to 17 minutes. At the 12 MiB limit this would be 60
    // hours of samples, held in memory, before the length was ever checked.
    const pages = Array.from({ length: 200 }, (_, index) => emptyPacketPage(serial, index === 199 ? 48000 : -1))
    await expect(prepareSpeechAudio(concat([head!, tags!, ...pages]))).rejects.toThrow('duration')
  })
})

test('formats it cannot decode are refused by name, never as a length problem', async () => {
  const vorbis = oggPage(concat([new Uint8Array([1]), ascii('vorbis'), new Uint8Array(23)]))
  const cases: Array<[Uint8Array, string]> = [
    [concat([ascii('ID3'), new Uint8Array([3, 0, 0, 0, 0, 0, 0]), new Uint8Array(64)]), 'MP3'],
    [new Uint8Array(64).map((_, index) => [0xFF, 0xFB, 0x90][index] ?? 0), 'MP3'],
    [new Uint8Array(64).map((_, index) => [0xFF, 0xF1][index] ?? 0), 'ADTS'],
    [concat([ascii('fLaC'), new Uint8Array(64)]), 'FLAC'],
    [concat([ascii('#!AMR\n'), new Uint8Array(64)]), 'AMR'],
    [vorbis, 'Vorbis'],
    [oggPage(concat([ascii('Speex   '), new Uint8Array(72)])), 'Speex'],
    // IMA ADPCM, which the WAV reader itself declines.
    [wav(0.1, { format: 0x11, bits: 4 }), 'WAV format 17'],
  ]
  for (const [bytes, name] of cases) {
    const error: Error = await prepareSpeechAudio(bytes).then(() => { throw new Error(`${name} decoded`) }, (cause: Error) => cause)
    expect(error.message).toContain(name)
    expect(error.message).toContain('not supported')
    // hq.training tells an athlete "record a shorter one" on any /duration/.
    expect(error.message).not.toMatch(/duration/i)
  }
})

test('a WAV header cannot ask the resampler for an absurd sample rate', async () => {
  // 192 samples claiming 4,294,967,040 Hz: the resampler's filter for that
  // rate alone took 5 s and a gigabyte, whatever the file's length.
  const claimed = wav(0.001, { rate: 192000, tone: true })
  new DataView(claimed.buffer).setUint32(24, 4294967040, true)
  await expect(prepareSpeechAudio(claimed)).rejects.toThrow('sample rate')
  expect((await prepareSpeechAudio(wav(1, { rate: 192000, tone: true }))).durationSeconds).toBe(1)
})

describe('cancellation and the decoder deadline', () => {
  test('a signal aborted before the call stops it with its own reason', async () => {
    const controller = new AbortController()
    const reason = new Error('the client went away')
    controller.abort(reason)
    await expect(prepareSpeechAudio(wav(1), { signal: controller.signal })).rejects.toBe(reason)
  })

  test('a signal aborted while decoding stops it with its own reason', async () => {
    const controller = new AbortController()
    const pending = prepareSpeechAudio(await fixture('voice.m4a'), { signal: controller.signal })
    controller.abort()
    const error = await pending.then(() => null, (cause: unknown) => cause)
    expect(error).toBe(controller.signal.reason)
    expect((error as DOMException).name).toBe('AbortError')
  })

  test('decoding past the deadline is refused', async () => {
    await expect(prepareSpeechAudio(await fixture('voice.m4a'), { timeoutMs: 1 })).rejects.toThrow('Audio decoder timed out')
  })
})

describe('the decoder is in-process', () => {
  const spies: Array<{ mockRestore: () => void }> = []
  afterEach(() => spies.splice(0).forEach(spy => spy.mockRestore()))

  test('no process is started, and FFmpeg is neither needed nor looked for', async () => {
    const spawn = spyOn(Bun, 'spawn')
    const spawnSync = spyOn(Bun, 'spawnSync')
    const which = spyOn(Bun, 'which')
    spies.push(spawn, spawnSync, which)
    for (const name of ['voice-aac-lc.m4a', 'voice-opus-silk.opus', 'voice-opus-celt.webm'])
      await prepareSpeechAudio(await fixture(name), { decoderPath: '/nonexistent/ffmpeg' })
    expect(spawn).not.toHaveBeenCalled()
    expect(spawnSync).not.toHaveBeenCalled()
    expect(which).not.toHaveBeenCalled()
  })

  test('only bytes are accepted, never a path or URL to read', async () => {
    // @ts-expect-error a string is what an untyped caller could pass
    await expect(prepareSpeechAudio('/etc/hosts')).rejects.toThrow(TypeError)
  })
})

test('phone M4A containers with their index after the audio can be decoded', async () => {
  const prepared = await prepareSpeechAudio(await fixture('voice.m4a'))
  expect(prepared.durationSeconds).toBeGreaterThanOrEqual(60)
  expect(prepared.durationSeconds).toBeLessThan(60.1)
})

test('seekable upload decoding cannot fetch a playlist’s external segments', async () => {
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() { requests++; return new Response('not audio') } })
  try {
    const playlist = ascii(`#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nhttp://127.0.0.1:${server.port}/private-audio.ts\n#EXT-X-ENDLIST\n`)
    await expect(prepareSpeechAudio(playlist)).rejects.toThrow()
    expect(requests).toBe(0)
  }
  finally { await server.stop(true) }
})
