import { expect, test } from 'bun:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureLocalSpeechModel } from '../src/local-speech-model'

const body = new TextEncoder().encode('verified speech fixture\n')
const checksum = '33dd4760476a60ee3b059824c66bf0f140afd7ae0149a8bce64a2f2d2b4aa99f'

test('publishes a verified pinned speech model and reuses its valid cache', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() { requests++; return new Response(body) } })
  const model = { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }
  try {
    const path = await ensureLocalSpeechModel({ directory, model })
    expect(path).toBe(join(directory, 'fixture.bin'))
    expect(await readFile(path)).toEqual(Buffer.from('verified speech fixture\n'))
    expect(await ensureLocalSpeechModel({ directory, model })).toBe(path)
    expect(requests).toBe(1)
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
})

test('resumes a timed-out response from its received prefix', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  const ranges: Array<string | null> = []
  const server = Bun.serve({ port: 0, fetch(request) {
    ranges.push(request.headers.get('range'))
    if (ranges.length === 1) return new Response(new ReadableStream({ start(controller) { controller.enqueue(body.slice(0, 8)) } }), { headers: { 'Content-Length': String(body.length) } })
    return new Response(body.slice(8), { status: 206, headers: { 'Content-Range': `bytes 8-${body.length - 1}/${body.length}` } })
  } })
  const model = { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }
  try {
    const path = await ensureLocalSpeechModel({ directory, model, timeoutMs: 300, attempts: 2 })
    expect(await readFile(path, 'utf8')).toBe('verified speech fixture\n')
    expect(ranges).toEqual([null, 'bytes=8-'])
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
}, 5000)

test('accepts complete verified bytes when only the final stream close times out', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() {
    requests++
    return requests === 1 ? new Response(new ReadableStream({ start(controller) { controller.enqueue(body) } })) : new Response(body)
  } })
  try {
    const path = await ensureLocalSpeechModel({ directory, model: { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }, timeoutMs: 300, attempts: 2 })
    expect(await readFile(path, 'utf8')).toBe('verified speech fixture\n')
    expect(requests).toBe(1)
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
}, 5000)

test('restarts safely when the origin ignores a resumed Range request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  const ranges: Array<string | null> = []
  const server = Bun.serve({ port: 0, fetch(request) {
    ranges.push(request.headers.get('range'))
    if (ranges.length === 1) return new Response(new ReadableStream({ start(controller) { controller.enqueue(body.slice(0, 8)) } }))
    return new Response(body)
  } })
  try {
    const path = await ensureLocalSpeechModel({ directory, model: { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }, timeoutMs: 300, attempts: 2 })
    expect(await readFile(path, 'utf8')).toBe('verified speech fixture\n')
    expect(ranges).toEqual([null, 'bytes=8-'])
    expect(await readdir(directory)).toEqual(['fixture.bin'])
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
}, 5000)

test('rejects a mismatched resume range without publishing any model', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() {
    requests++
    if (requests === 1) return new Response(new ReadableStream({ start(controller) { controller.enqueue(body.slice(0, 8)) } }))
    return new Response(body.slice(9), { status: 206, headers: { 'Content-Range': `bytes 9-${body.length - 1}/${body.length}` } })
  } })
  try {
    await expect(ensureLocalSpeechModel({ directory, model: { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }, timeoutMs: 300, attempts: 2 })).rejects.toThrow('could not be verified after 2 download attempts')
    expect(requests).toBe(2)
    expect(await readdir(directory)).toEqual([])
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
}, 5000)

test('keeps the previous file intact when new bytes fail their checksum', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  await writeFile(join(directory, 'fixture.bin'), 'the previous model stays intact')
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() { requests++; return new Response(new Uint8Array(body.length).fill(65)) } })
  try {
    await expect(ensureLocalSpeechModel({ directory, model: { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }, attempts: 2 })).rejects.toThrow('could not be verified after 2 download attempts')
    expect(requests).toBe(2)
    expect(await readFile(join(directory, 'fixture.bin'), 'utf8')).toBe('the previous model stays intact')
    expect(await readdir(directory)).toEqual(['fixture.bin'])
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
})

test('bounds downloaded bytes before accepting an oversized response', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  const server = Bun.serve({ port: 0, fetch() { return new Response(new Uint8Array(body.length + 1)) } })
  try {
    await expect(ensureLocalSpeechModel({ directory, model: { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }, attempts: 1 })).rejects.toThrow('could not be verified after 1 download attempts')
    expect(await readdir(directory)).toEqual([])
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
})

test('honors caller cancellation without starting another download attempt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-speech-model-'))
  const controller = new AbortController()
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() {
    requests++
    setTimeout(() => controller.abort(new Error('operator stopped')), 50)
    return new Response(new ReadableStream({ start(stream) { stream.enqueue(body.slice(0, 8)) } }))
  } })
  try {
    await expect(ensureLocalSpeechModel({ directory, model: { filename: 'fixture.bin', url: server.url.href, sha256: checksum, bytes: body.length }, signal: controller.signal })).rejects.toThrow('operator stopped')
    expect(requests).toBe(1)
    expect(await readdir(directory)).toEqual([])
  }
  finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
})
