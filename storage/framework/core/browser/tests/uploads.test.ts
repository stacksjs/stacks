import { describe, expect, test } from 'bun:test'
import { uploadInParts, UploadRefused, uploadResumeKey } from '../src/utils/uploads'

const PART = 1000

/** A server for the session routes, in memory, that can be told to misbehave. */
function fakeServer(options: { failPart?: (index: number, attempt: number) => number | 'network' | undefined, maxBytes?: number } = {}) {
  const sessions = new Map<string, { size: number, parts: Map<number, Uint8Array>, total: number }>()
  const calls: string[] = []
  const attempts = new Map<number, number>()
  let next = 0
  const view = (id: string) => {
    const session = sessions.get(id)!
    return { upload: { id, size: session.size, partBytes: PART, parts: session.total, received: [...session.parts.keys()].sort((a, b) => a - b) } }
  }
  const transport = async (path: string, init: RequestInit): Promise<Response> => {
    calls.push(`${init.method} ${path}`)
    if (init.signal?.aborted)
      throw new DOMException('aborted', 'AbortError')
    const part = /^\/uploads\/([a-f0-9]{32})\/parts\/(\d+)$/.exec(path)
    if (init.method === 'POST' && path === '/uploads') {
      const body = JSON.parse(String(init.body))
      if (options.maxBytes && body.size > options.maxBytes)
        return Response.json({ error: 'Keep the file under the limit.' }, { status: 413 })
      const id = (next++).toString(16).padStart(32, '0')
      sessions.set(id, { size: body.size, parts: new Map(), total: Math.ceil(body.size / PART) })
      return Response.json(view(id), { status: 201 })
    }
    if (init.method === 'PUT' && part) {
      const index = Number(part[2])
      const attempt = (attempts.get(index) ?? 0) + 1
      attempts.set(index, attempt)
      const fail = options.failPart?.(index, attempt)
      if (fail === 'network')
        throw new TypeError('Failed to fetch')
      if (fail)
        return Response.json({ error: 'nope' }, { status: fail })
      const session = sessions.get(part[1]!)
      if (!session)
        return Response.json({ error: 'No such upload.' }, { status: 404 })
      session.parts.set(index, new Uint8Array(await (init.body as Blob).arrayBuffer()))
      return Response.json(view(part[1]!))
    }
    const one = /^\/uploads\/([a-f0-9]{32})$/.exec(path)
    if (init.method === 'GET' && one)
      return sessions.has(one[1]!) ? Response.json(view(one[1]!)) : Response.json({ error: 'No such upload.' }, { status: 404 })
    if (init.method === 'DELETE' && one) {
      sessions.delete(one[1]!)
      return new Response(null, { status: 204 })
    }
    return new Response('?', { status: 500 })
  }
  const joined = (id: string): Uint8Array => {
    const session = sessions.get(id)!
    const out = new Uint8Array(session.size)
    for (const [index, bytes] of session.parts) out.set(bytes, index * PART)
    return out
  }
  return { transport, calls, sessions, joined, attempts }
}

function memoryStorage() {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value), removeItem: (key: string) => void items.delete(key), items }
}

const fileOf = (size: number): File => {
  const bytes = new Uint8Array(size)
  for (let at = 0; at < size; at++) bytes[at] = (at * 7) & 0xFF
  return new File([bytes], 'squat.mov', { type: 'video/quicktime', lastModified: 1_700_000_000_000 })
}

describe('uploading a file in parts', () => {
  test('every byte arrives once, and progress ends at the whole', async () => {
    const server = fakeServer()
    const file = fileOf(PART * 4 + 321)
    const seen: number[] = []
    const session = await uploadInParts(file, { transport: server.transport, endpoint: '/uploads/', onProgress: progress => seen.push(progress.loaded), storage: null })
    expect(session.parts).toBe(5)
    expect(server.joined(session.id)).toEqual(new Uint8Array(await file.arrayBuffer()))
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(file.size)
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })

  test('a part that fails is sent again, and only that part', async () => {
    // Part 2 drops on the line twice, then meets a busy server once.
    const server = fakeServer({ failPart: (index, attempt) => index === 2 ? ([undefined, 'network', 'network', 503] as const)[attempt] : undefined })
    const file = fileOf(PART * 4)
    const session = await uploadInParts(file, { transport: server.transport, endpoint: '/uploads', retryDelay: 1, storage: null })
    expect(server.joined(session.id)).toEqual(new Uint8Array(await file.arrayBuffer()))
    expect(server.attempts.get(2)).toBe(4)
    expect([0, 1, 3].map(index => server.attempts.get(index))).toEqual([1, 1, 1])
  })

  test('a refusal is not retried, and says what the server said', async () => {
    const server = fakeServer({ maxBytes: 100 })
    const error = await uploadInParts(fileOf(PART), { transport: server.transport, endpoint: '/uploads', retryDelay: 1, storage: null }).catch(cause => cause)
    expect(error).toBeInstanceOf(UploadRefused)
    expect(error.status).toBe(413)
    expect(error.message).toBe('Keep the file under the limit.')
    expect(server.calls).toEqual(['POST /uploads'])
  })

  test('picked again after a failure, the same file continues where it stopped', async () => {
    const storage = memoryStorage()
    // The line is down for part 3, for good.
    const server = fakeServer({ failPart: index => index === 3 ? 'network' : undefined })
    const file = fileOf(PART * 5)
    const key = uploadResumeKey(file, 'exercise')
    const options = { transport: server.transport, endpoint: '/uploads', retryDelay: 1, retries: 1, concurrency: 1, resumeKey: key, storage }
    await expect(uploadInParts(file, options)).rejects.toThrow('Failed to fetch')
    const id = storage.items.get(key)!
    expect([...server.sessions.get(id)!.parts.keys()]).toEqual([0, 1, 2])

    // Back on the line: only what is missing goes.
    const again = fakeServer()
    again.sessions.set(id, server.sessions.get(id)!)
    const before = again.calls.length
    const session = await uploadInParts(file, { ...options, transport: again.transport })
    expect(session.id).toBe(id)
    expect(again.calls.slice(before)).toEqual([`GET /uploads/${id}`, `PUT /uploads/${id}/parts/3`, `PUT /uploads/${id}/parts/4`])
    expect(again.joined(id)).toEqual(new Uint8Array(await file.arrayBuffer()))
  })

  test('a remembered session the server no longer has starts a new one', async () => {
    const storage = memoryStorage()
    const file = fileOf(PART * 2)
    const key = uploadResumeKey(file)
    storage.setItem(key, 'f'.repeat(32))
    const server = fakeServer()
    const session = await uploadInParts(file, { transport: server.transport, endpoint: '/uploads', retryDelay: 1, resumeKey: key, storage })
    expect(session.id).not.toBe('f'.repeat(32))
    expect(storage.items.get(key)).toBe(session.id)
  })

  test('cancelling stops the parts, removes the session and forgets it', async () => {
    const storage = memoryStorage()
    const controller = new AbortController()
    const server = fakeServer()
    const file = fileOf(PART * 6)
    const key = uploadResumeKey(file)
    const transport: typeof server.transport = async (path, init) => {
      const response = await server.transport(path, init)
      if (path.endsWith('/parts/1'))
        controller.abort()
      return response
    }
    const error = await uploadInParts(file, { transport, endpoint: '/uploads', concurrency: 1, resumeKey: key, storage, signal: controller.signal }).catch(cause => cause)
    expect(error.name).toBe('AbortError')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(server.calls.at(-1)).toMatch(/^DELETE \/uploads\/[a-f0-9]{32}$/)
    expect(server.calls.filter(call => call.startsWith('PUT'))).toHaveLength(2)
    expect(storage.items.has(key)).toBe(false)
  })

  test('progress never goes backwards, with parts finishing side by side or sent again', async () => {
    // Part 1 drops once after reporting most of itself.
    const server = fakeServer({ failPart: (index, attempt) => index === 1 && attempt === 1 ? 'network' : undefined })
    const file = fileOf(PART * 4)
    const seen: number[] = []
    const transport: Parameters<typeof uploadInParts>[1]['transport'] = async (path, init) => {
      init.onUploadProgress?.({ loaded: 900, total: PART })
      return server.transport(path, init)
    }
    await uploadInParts(file, { transport, endpoint: '/uploads', concurrency: 3, retryDelay: 1, transportReportsProgress: true, onProgress: progress => seen.push(progress.loaded), storage: null })
    expect(seen.at(-1)).toBe(file.size)
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })

  test('progress within a part comes from a transport that reports it', async () => {
    const server = fakeServer()
    const file = fileOf(PART * 2)
    const seen: number[] = []
    const transport: Parameters<typeof uploadInParts>[1]['transport'] = async (path, init) => {
      init.onUploadProgress?.({ loaded: 400, total: PART })
      return server.transport(path, init)
    }
    await uploadInParts(file, { transport, endpoint: '/uploads', concurrency: 1, transportReportsProgress: true, onProgress: progress => seen.push(progress.loaded), storage: null })
    expect(seen).toEqual([0, 400, 1000, 1400, 2000])
  })
})
