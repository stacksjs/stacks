import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUploadSessions, handleUploadSessionRequest, receiveUpload, uploadSessionResponse, UploadSessionError } from '../src/upload-sessions'

let directory = ''
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'upload-sessions-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

const PART = 64 * 1024
const sessions = (overrides: Record<string, unknown> = {}) => createUploadSessions({ directory, maxBytes: 10 * 1024 * 1024, partBytes: PART, ...overrides })

/** Bytes whose value says where they are, so a part in the wrong place is seen. */
function fileOf(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  for (let at = 0; at < size; at++) bytes[at] = (at * 31 + (at >> 8)) & 0xFF
  return bytes
}

const refusal = async (work: Promise<unknown>): Promise<UploadSessionError> => {
  try {
    await work
  }
  catch (error) {
    if (error instanceof UploadSessionError)
      return error
    throw error
  }
  throw new Error('expected a refusal')
}

describe('upload sessions', () => {
  test('a file sent in parts, in any order, comes out as the file', async () => {
    const uploads = sessions()
    const file = fileOf(PART * 3 + 1234)
    const begun = await uploads.begin({ owner: '7', name: 'squat.mov', size: file.byteLength, type: 'video/quicktime', meta: { purpose: 'exercise' } })
    expect(begun).toMatchObject({ parts: 4, partBytes: PART, received: [], complete: false, name: 'squat.mov' })

    for (const index of [2, 0, 3, 1])
      await uploads.receive(begun.id, '7', index, file.subarray(index * PART, (index + 1) * PART))

    const done = await uploads.complete(begun.id, '7')
    expect(done).toMatchObject({ complete: true, size: file.byteLength, type: 'video/quicktime', meta: { purpose: 'exercise' } })
    expect(new Uint8Array(await Bun.file(done.path).arrayBuffer())).toEqual(file)
    // The parts are gone once joined: the file is not kept twice.
    expect((await readdir(join(directory, begun.id))).sort()).toEqual(['file', 'manifest.json'])

    await done.discard()
    expect(await readdir(directory)).toEqual([])
  })

  test('status says which parts arrived, so a client sends only the rest', async () => {
    const uploads = sessions()
    const file = fileOf(PART * 3)
    const { id } = await uploads.begin({ owner: 'a', name: 'clip.mp4', size: file.byteLength })
    await uploads.receive(id, 'a', 1, file.subarray(PART, PART * 2))
    expect((await uploads.status(id, 'a')).received).toEqual([1])
    // Sent again after a timeout the client could not tell from a failure: still one part.
    await uploads.receive(id, 'a', 1, file.subarray(PART, PART * 2))
    expect((await uploads.status(id, 'a')).received).toEqual([1])
    expect((await refusal(uploads.complete(id, 'a'))).code).toBe('incomplete')
  })

  test('completing twice answers the same file', async () => {
    const uploads = sessions()
    const file = fileOf(1000)
    const { id } = await uploads.begin({ owner: 'a', name: 'clip.mp4', size: 1000 })
    await uploads.receive(id, 'a', 0, new Blob([file]))
    const first = await uploads.complete(id, 'a')
    const second = await uploads.complete(id, 'a')
    expect(second.path).toBe(first.path)
    expect((await uploads.status(id, 'a')).received).toEqual([0])
  })

  test('a part of the wrong size or place is refused', async () => {
    const uploads = sessions()
    const { id } = await uploads.begin({ owner: 'a', name: 'clip.mp4', size: PART + 10 })
    expect((await refusal(uploads.receive(id, 'a', 0, new Uint8Array(PART - 1)))).code).toBe('bad-part')
    expect((await refusal(uploads.receive(id, 'a', 1, new Uint8Array(PART)))).code).toBe('bad-part')
    expect((await refusal(uploads.receive(id, 'a', 2, new Uint8Array(10)))).code).toBe('bad-part')
    expect((await refusal(uploads.receive(id, 'a', -1, new Uint8Array(10)))).code).toBe('bad-part')
    expect((await uploads.status(id, 'a')).received).toEqual([])
  })

  test('another account cannot see, fill, finish or remove a session', async () => {
    const uploads = sessions()
    const { id } = await uploads.begin({ owner: 'a', name: 'clip.mp4', size: 10 })
    for (const work of [() => uploads.status(id, 'b'), () => uploads.receive(id, 'b', 0, new Uint8Array(10)), () => uploads.complete(id, 'b'), () => uploads.abort(id, 'b')]) {
      const error = await refusal(work())
      expect(error.code).toBe('not-found')
      expect(error.status).toBe(404)
    }
    expect((await uploads.status(id, 'a')).received).toEqual([])
  })

  test('an id is never a path', async () => {
    const uploads = sessions()
    for (const id of ['../x', '..', 'a/b', '', 'ABCDEF0123456789ABCDEF0123456789', `${'a'.repeat(32)}/..`])
      expect((await refusal(uploads.status(id, 'a'))).code).toBe('not-found')
  })

  test('a file over the limit, or without a size, is refused before anything is stored', async () => {
    const uploads = sessions({ maxBytes: 1000 })
    expect((await refusal(uploads.begin({ owner: 'a', name: 'big.mov', size: 1001 }))).status).toBe(413)
    expect((await refusal(uploads.begin({ owner: 'a', name: 'none.mov', size: 0 }))).status).toBe(422)
    expect((await refusal(uploads.begin({ owner: '', name: 'none.mov', size: 10 }))).status).toBe(422)
    expect(await readdir(directory)).toEqual([])
  })

  test('an account can leave only so many uploads unfinished', async () => {
    const uploads = sessions({ maxOpenPerOwner: 2 })
    const first = await uploads.begin({ owner: 'a', name: '1.mp4', size: 10 })
    await uploads.begin({ owner: 'a', name: '2.mp4', size: 10 })
    expect((await refusal(uploads.begin({ owner: 'a', name: '3.mp4', size: 10 }))).status).toBe(429)
    // Someone else's are their own, and a cancelled one frees its place.
    await uploads.begin({ owner: 'b', name: '1.mp4', size: 10 })
    await uploads.abort(first.id, 'a')
    await uploads.begin({ owner: 'a', name: '3.mp4', size: 10 })
  })

  test('a name keeps its extension and loses its directories', async () => {
    const uploads = sessions()
    const begun = await uploads.begin({ owner: 'a', name: '../../etc/My Clip.MOV', size: 10, meta: { 'purpose': 'exercise', 'bad key': 'x', 'n': 5 as unknown as string } })
    expect(begun.name).toBe('My Clip.MOV')
    expect(begun.meta).toEqual({ purpose: 'exercise', n: '5' })
  })

  test('prune removes what was left unfinished for longer than the TTL', async () => {
    const uploads = sessions({ ttlSeconds: 60 })
    const old = await uploads.begin({ owner: 'a', name: 'old.mp4', size: 10 })
    const fresh = await uploads.begin({ owner: 'a', name: 'new.mp4', size: 10 })
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
    await utimes(join(directory, old.id), past, past)
    expect(await uploads.prune()).toBe(1)
    expect((await refusal(uploads.status(old.id, 'a'))).code).toBe('not-found')
    expect((await uploads.status(fresh.id, 'a')).id).toBe(fresh.id)
  })
})

describe('the upload session routes', () => {
  const routes = (overrides: Record<string, unknown> = {}) => {
    const uploads = sessions()
    const call = (method: string, params: Record<string, unknown>, body?: unknown, extra: { owner?: string | null, length?: number } = {}) => handleUploadSessionRequest({
      method,
      params,
      headers: { get: (name: string) => name === 'content-length' && extra.length !== undefined ? String(extra.length) : null },
      json: async () => body,
      arrayBuffer: async () => (body as Uint8Array).buffer.slice((body as Uint8Array).byteOffset, (body as Uint8Array).byteOffset + (body as Uint8Array).byteLength) as ArrayBuffer,
    }, uploads, { owner: extra.owner === undefined ? '7' : extra.owner, accept: file => /\.mov$/.test(file.name) ? null : 'Choose a video.', ...overrides })
    return { uploads, call }
  }

  test('begin, parts, status and cancel, each answering as the browser client expects', async () => {
    const { uploads, call } = routes()
    const file = fileOf(PART + 10)
    const begun = await call('POST', {}, { name: 'squat.mov', size: file.byteLength, type: 'video/quicktime' })
    expect(begun.status).toBe(201)
    const { upload } = await begun.json() as { upload: { id: string, parts: number } }
    expect(upload.parts).toBe(2)
    expect((await call('PUT', { id: upload.id, index: 0 }, file.subarray(0, PART), { length: PART })).status).toBe(200)
    const status = await (await call('GET', { id: upload.id })).json() as { upload: { received: number[] } }
    expect(status.upload.received).toEqual([0])
    expect((await call('DELETE', { id: upload.id })).status).toBe(200)
    expect((await call('GET', { id: upload.id })).status).toBe(404)
    expect(await uploads.prune(Date.now() + 10 ** 12)).toBe(0)
  })

  test('refuses what the app does not accept, an oversized part unread, and anyone signed out', async () => {
    const { call } = routes()
    const refused = await call('POST', {}, { name: 'notes.pdf', size: 10 })
    expect(refused.status).toBe(422)
    expect((await refused.json() as { error: string }).error).toBe('Choose a video.')
    const { upload } = await (await call('POST', {}, { name: 'a.mov', size: 10 })).json() as { upload: { id: string } }
    expect((await call('PUT', { id: upload.id, index: 0 }, new Uint8Array(10), { length: PART + 1 })).status).toBe(413)
    expect((await call('GET', { id: upload.id }, undefined, { owner: null })).status).toBe(401)
    expect((await call('GET', { id: upload.id }, undefined, { owner: '8' })).status).toBe(404)
  })
})

describe('receiving an upload in an action', () => {
  test('a session\'s finished file, or the multipart file, or nothing', async () => {
    const uploads = sessions()
    const file = fileOf(PART + 5)
    const begun = await uploads.begin({ owner: '7', name: 'clip.mov', size: file.byteLength, type: 'video/quicktime' })
    await uploads.receive(begun.id, '7', 0, file.subarray(0, PART))
    await uploads.receive(begun.id, '7', 1, file.subarray(PART))
    const fromSession = await receiveUpload({ method: 'POST', headers: { get: () => null }, get: name => name === 'upload' ? begun.id : undefined }, { owner: 7, sessions: uploads })
    expect(fromSession).toMatchObject({ name: 'clip.mov', size: file.byteLength, type: 'video/quicktime', fromSession: true })
    expect(new Uint8Array(await fromSession!.blob.arrayBuffer())).toEqual(file)
    await fromSession!.discard()
    expect(await readdir(directory)).toEqual([])

    const whole = new File([file], 'small.mov', { type: 'video/quicktime' })
    const fromRequest = await receiveUpload({ method: 'POST', headers: { get: () => null }, get: () => undefined, file: name => name === 'video' ? whole : undefined }, { owner: 7, sessions: uploads, field: 'video' })
    expect(fromRequest).toMatchObject({ name: 'small.mov', fromSession: false, size: file.byteLength })
    // As the router hands it over: its UploadedFile, wrapping the File.
    const { UploadedFile } = await import('../src/uploaded-file')
    const wrapped = await receiveUpload({ method: 'POST', headers: { get: () => null }, get: () => undefined, file: () => new UploadedFile(whole) }, { owner: 7, sessions: uploads })
    expect(wrapped).toMatchObject({ name: 'small.mov', type: 'video/quicktime', fromSession: false })
    expect(new Uint8Array(await wrapped!.blob.arrayBuffer())).toEqual(file)
    expect(await receiveUpload({ method: 'POST', headers: { get: () => null }, get: () => undefined, file: () => undefined }, { owner: 7, sessions: uploads })).toBeNull()
    const error = await receiveUpload({ method: 'POST', headers: { get: () => null }, get: () => 'f'.repeat(32) }, { owner: 7, sessions: uploads }).catch(cause => cause)
    expect(uploadSessionResponse(error).status).toBe(404)
  })
})
