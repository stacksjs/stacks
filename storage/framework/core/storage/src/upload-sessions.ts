import { randomBytes } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Uploads that arrive in parts and survive a dropped connection.
 *
 * A browser sends a large file as one request, and one request is all or
 * nothing: a phone that loses signal at 90% starts again from zero, and a
 * gateway with a body limit refuses the file outright however fast the line
 * is. Here the client announces the file (`begin`), sends it in parts of a
 * few megabytes (`receive`), each one retried on its own, and asks for the
 * whole (`complete`). A part that arrived is never sent again, including
 * after the page was reloaded: `status` says which ones are in.
 *
 * Parts are kept on this machine's filesystem, one file each, and joined into
 * one file on `complete`. What the application does with that file (probe it,
 * put it on a disk, attach it to a record) is its own business; it calls
 * `discard()` when it is done. The parts are written to a local directory
 * rather than a `Storage` disk on purpose: an object store cannot append, and
 * every consumer so far needs the finished file as a path (a probe, a
 * transcoder, a streamed `putStream`). An application running several servers
 * points `directory` at a volume they share, or routes a session's requests
 * to one of them.
 *
 * Nothing here knows about HTTP or accounts. The application's routes call
 * these with an `owner` (an account id, say) and every call after `begin`
 * must name the same one; a session asked for by anyone else does not exist.
 */

export interface UploadSessionsOptions {
  /** A directory on this machine that only this process writes to. Created when missing. */
  directory: string
  /** The largest file a session may announce, in bytes. */
  maxBytes: number
  /** Bytes in each part but the last. Default 8 MiB, which fits under any common gateway limit. */
  partBytes?: number
  /** Seconds an unfinished session is kept after its last part. Default a day. */
  ttlSeconds?: number
  /** Unfinished sessions one owner may have at once. Default 8. */
  maxOpenPerOwner?: number
}

export interface BeginUpload {
  owner: string
  /** The file's own name, kept for its extension. Never used as a path. */
  name: string
  size: number
  type?: string
  /** Small strings the application wants back on `complete` (what the file is for). */
  meta?: Record<string, string>
}

/** What a client is told about a session. */
export interface UploadSessionView {
  id: string
  name: string
  size: number
  type: string
  partBytes: number
  parts: number
  /** Indices of the parts that have arrived whole, ascending. */
  received: number[]
  complete: boolean
  meta: Record<string, string>
}

/** A finished upload, as one file on this machine. */
export interface CompletedUpload extends UploadSessionView {
  /** Where the joined file is. Gone after `discard()` or when the session expires. */
  path: string
  /** Removes the session and its file. Call it once the file has been taken. */
  discard: () => Promise<void>
}

export type UploadSessionErrorCode = 'invalid' | 'too-large' | 'too-many' | 'not-found' | 'bad-part' | 'incomplete'

/** A refusal the client caused, with the HTTP status that says so. */
export class UploadSessionError extends Error {
  readonly status: number
  constructor(readonly code: UploadSessionErrorCode, message: string) {
    super(message)
    this.name = 'UploadSessionError'
    this.status = ({ 'invalid': 422, 'too-large': 413, 'too-many': 429, 'not-found': 404, 'bad-part': 422, 'incomplete': 409 } as const)[code]
  }
}

interface Manifest {
  id: string
  owner: string
  name: string
  size: number
  type: string
  partBytes: number
  parts: number
  meta: Record<string, string>
  createdAt: number
}

export interface UploadSessions {
  begin: (input: BeginUpload) => Promise<UploadSessionView>
  status: (id: string, owner: string) => Promise<UploadSessionView>
  /** Stores one part. Sending a part again replaces it, so a retry is always safe. */
  receive: (id: string, owner: string, index: number, body: Uint8Array | ArrayBuffer | Blob) => Promise<UploadSessionView>
  /** Joins the parts into one file. Safe to call again: a finished session answers the same file. */
  complete: (id: string, owner: string) => Promise<CompletedUpload>
  abort: (id: string, owner: string) => Promise<void>
  /** Removes sessions untouched for longer than the TTL; answers how many. Run it from a scheduler. */
  prune: (now?: number) => Promise<number>
}

const ID = /^[a-f0-9]{32}$/
const PART = /^(\d{1,6})\.part$/
const DEFAULT_PART_BYTES = 8 * 1024 * 1024
/** A part table past this is a mistake or an attack, not a file. */
const MAX_PARTS = 10_000

const missing = (): UploadSessionError => new UploadSessionError('not-found', 'No such upload.')

function cleanMeta(meta: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!meta || typeof meta !== 'object')
    return out
  for (const [key, value] of Object.entries(meta as Record<string, unknown>).slice(0, 16)) {
    if (/^[\w-]{1,64}$/.test(key) && (typeof value === 'string' || typeof value === 'number'))
      out[key] = String(value).slice(0, 512)
  }
  return out
}

/** A name with no directory in it, short enough to store: only its extension is ever read. */
function cleanName(name: unknown): string {
  const base = String(name ?? '').split(/[/\\]/).pop() || ''
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001F\u007F]/g, '').slice(-200) || 'upload'
}

export function createUploadSessions(options: UploadSessionsOptions): UploadSessions {
  const partBytes = Math.max(64 * 1024, Math.floor(options.partBytes ?? DEFAULT_PART_BYTES))
  const ttl = Math.max(60, options.ttlSeconds ?? 24 * 60 * 60) * 1000
  const maxOpen = Math.max(1, options.maxOpenPerOwner ?? 8)
  const root = options.directory

  const dirOf = (id: string): string => join(root, id)
  const manifestPath = (id: string): string => join(dirOf(id), 'manifest.json')
  const partPath = (id: string, index: number): string => join(dirOf(id), `${index}.part`)
  const filePath = (id: string): string => join(dirOf(id), 'file')

  /** The size part `index` must be: `partBytes`, or what is left for the last one. */
  const expected = (manifest: Manifest, index: number): number =>
    index === manifest.parts - 1 ? manifest.size - partBytesOf(manifest) * (manifest.parts - 1) : partBytesOf(manifest)
  const partBytesOf = (manifest: Manifest): number => manifest.partBytes

  async function load(id: string, owner: string): Promise<Manifest> {
    // The id is the only part of a path a client chooses, so it is checked before it is one.
    if (!ID.test(String(id)))
      throw missing()
    const file = Bun.file(manifestPath(id))
    if (!await file.exists())
      throw missing()
    const manifest = await file.json().catch(() => null) as Manifest | null
    // Someone else's session is answered exactly as one that never was.
    if (!manifest || manifest.id !== id || manifest.owner !== String(owner))
      throw missing()
    return manifest
  }

  async function received(manifest: Manifest): Promise<number[]> {
    const names = await readdir(dirOf(manifest.id)).catch(() => [] as string[])
    const indices: number[] = []
    for (const name of names) {
      const index = Number(PART.exec(name)?.[1] ?? Number.NaN)
      // A part counts once it is whole: it is renamed into place only after its last byte.
      if (Number.isInteger(index) && index >= 0 && index < manifest.parts)
        indices.push(index)
    }
    return indices.sort((a, b) => a - b)
  }

  async function view(manifest: Manifest): Promise<UploadSessionView> {
    const complete = await Bun.file(filePath(manifest.id)).exists()
    return {
      id: manifest.id,
      name: manifest.name,
      size: manifest.size,
      type: manifest.type,
      partBytes: manifest.partBytes,
      parts: manifest.parts,
      received: complete ? Array.from({ length: manifest.parts }, (_, index) => index) : await received(manifest),
      complete,
      meta: manifest.meta,
    }
  }

  async function openCount(owner: string): Promise<number> {
    const ids = await readdir(root).catch(() => [] as string[])
    let count = 0
    for (const id of ids) {
      if (!ID.test(id))
        continue
      const manifest = await Bun.file(manifestPath(id)).json().catch(() => null) as Manifest | null
      if (manifest?.owner === owner && !await Bun.file(filePath(id)).exists())
        count++
    }
    return count
  }

  return {
    async begin(input) {
      const size = Number(input.size)
      const owner = String(input.owner ?? '')
      if (!owner)
        throw new UploadSessionError('invalid', 'An upload needs an owner.')
      if (!Number.isSafeInteger(size) || size <= 0)
        throw new UploadSessionError('invalid', 'An upload needs its size in bytes.')
      if (size > options.maxBytes)
        throw new UploadSessionError('too-large', `Keep the file under ${Math.floor(options.maxBytes / 1024 / 1024)}MB.`)
      const parts = Math.ceil(size / partBytes)
      if (parts > MAX_PARTS)
        throw new UploadSessionError('too-large', 'The file is too large to send in parts.')
      if (await openCount(owner) >= maxOpen)
        throw new UploadSessionError('too-many', 'Too many unfinished uploads. Finish or cancel one first.')

      const manifest: Manifest = {
        id: randomBytes(16).toString('hex'),
        owner,
        name: cleanName(input.name),
        size,
        type: String(input.type || 'application/octet-stream').slice(0, 128),
        partBytes,
        parts,
        meta: cleanMeta(input.meta),
        createdAt: Date.now(),
      }
      await mkdir(dirOf(manifest.id), { recursive: true })
      await Bun.write(manifestPath(manifest.id), JSON.stringify(manifest))
      return view(manifest)
    },

    async status(id, owner) {
      return view(await load(id, owner))
    },

    async receive(id, owner, index, body) {
      const manifest = await load(id, owner)
      if (await Bun.file(filePath(id)).exists())
        return view(manifest)
      if (!Number.isInteger(index) || index < 0 || index >= manifest.parts)
        throw new UploadSessionError('bad-part', 'No such part.')
      const bytes = body instanceof Blob ? body.size : body.byteLength
      // Exactly the size announced: a short part would leave a hole, a long one would overrun the limit.
      if (bytes !== expected(manifest, index))
        throw new UploadSessionError('bad-part', `Part ${index} must be ${expected(manifest, index)} bytes, not ${bytes}.`)
      // Written beside its name and renamed, so a part that exists is a part that is whole,
      // even if the connection or the process stopped halfway.
      const pending = join(dirOf(id), `${index}.${randomBytes(6).toString('hex')}.tmp`)
      try {
        await Bun.write(pending, body)
        await rename(pending, partPath(id, index))
      }
      catch (error) {
        await rm(pending, { force: true })
        throw error
      }
      return view(manifest)
    },

    async complete(id, owner) {
      const manifest = await load(id, owner)
      const finished = filePath(id)
      if (!await Bun.file(finished).exists()) {
        const have = await received(manifest)
        if (have.length !== manifest.parts)
          throw new UploadSessionError('incomplete', `${manifest.parts - have.length} of ${manifest.parts} parts have not arrived.`)
        const joining = join(dirOf(id), `file.${randomBytes(6).toString('hex')}.tmp`)
        try {
          const writer = Bun.file(joining).writer()
          let written = 0
          for (let index = 0; index < manifest.parts; index++) {
            // One part in memory at a time: the file may be far larger than this process should hold.
            const part = new Uint8Array(await Bun.file(partPath(id, index)).arrayBuffer())
            writer.write(part)
            await writer.flush()
            written += part.byteLength
          }
          await writer.end()
          if (written !== manifest.size)
            throw new UploadSessionError('incomplete', 'The parts do not add up to the file.')
          await rename(joining, finished)
        }
        catch (error) {
          await rm(joining, { force: true })
          throw error
        }
        for (let index = 0; index < manifest.parts; index++)
          await rm(partPath(id, index), { force: true })
      }
      return {
        ...await view(manifest),
        path: finished,
        discard: () => rm(dirOf(id), { recursive: true, force: true }),
      }
    },

    async abort(id, owner) {
      await load(id, owner)
      await rm(dirOf(id), { recursive: true, force: true })
    },

    async prune(now = Date.now()) {
      const ids = await readdir(root).catch(() => [] as string[])
      let removed = 0
      for (const id of ids) {
        if (!ID.test(id))
          continue
        // The directory's own time moves with every part that lands in it.
        const info = await stat(dirOf(id)).catch(() => null)
        if (info && now - info.mtimeMs > ttl) {
          await rm(dirOf(id), { recursive: true, force: true })
          removed++
        }
      }
      return removed
    },
  }
}

/**
 * The request an upload route receives, as much of it as these helpers read:
 * Stacks' router request, or any `Request` with `params` added.
 */
export interface UploadRouteRequest {
  method: string
  params?: Record<string, unknown>
  headers: { get: (name: string) => string | null }
  json?: () => Promise<unknown>
  arrayBuffer?: () => Promise<ArrayBuffer>
  get?: (name: string) => unknown
  file?: (name: string) => unknown
}

export interface UploadRouteOptions {
  /** Who is uploading: an account id. Null answers 401. */
  owner: string | number | null | undefined
  /**
   * Checks a file as it is announced, before any of it is sent: answer a
   * message to refuse it (422), or null to let it in. The size limit is the
   * sessions' own.
   */
  accept?: (file: { name: string, size: number, type: string }) => string | null
}

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

/** How a refused session call is answered: the refusal as itself, anything else as a 500 that says nothing of its own. */
export function uploadSessionResponse(cause: unknown): Response {
  if (cause instanceof UploadSessionError)
    return json({ error: cause.message, code: cause.code }, cause.status)
  console.error('[uploads] an upload session call failed', cause)
  return json({ error: 'Could not store the upload. Try again.' }, 500)
}

/**
 * Answers every upload session route from one handler, so an app's routes are
 * a line each (`uploadInParts` in `@stacksjs/browser` speaks them):
 *
 * - `POST   /uploads`                    begin: `{ name, size, type, meta }` → 201 `{ upload }`
 * - `GET    /uploads/{id}`               status → `{ upload }`
 * - `PUT    /uploads/{id}/parts/{index}` one part, the raw body → `{ upload }`
 * - `DELETE /uploads/{id}`               cancel → `{ ok: true }`
 *
 * It tells them apart by method and by which of `id` and `index` the route
 * captured. A part is read only after its declared length has been checked
 * against the part size, so an oversized body is refused unread.
 */
export async function handleUploadSessionRequest(request: UploadRouteRequest, sessions: UploadSessions, options: UploadRouteOptions): Promise<Response> {
  if (options.owner === null || options.owner === undefined || options.owner === '')
    return json({ error: 'Unauthenticated' }, 401)
  const owner = String(options.owner)
  const id = request.params?.id === undefined ? '' : String(request.params.id)
  const method = request.method.toUpperCase()
  try {
    if (method === 'POST' && !id) {
      const body = (await request.json?.().catch(() => ({})) ?? {}) as { name?: unknown, size?: unknown, type?: unknown, meta?: unknown }
      const file = { name: String(body.name ?? ''), size: Number(body.size), type: typeof body.type === 'string' ? body.type : '' }
      const refusal = options.accept?.(file)
      if (refusal)
        return json({ error: refusal, code: 'invalid' }, 422)
      return json({ upload: await sessions.begin({ owner, ...file, meta: body.meta as Record<string, string> | undefined }) }, 201)
    }
    if (method === 'PUT' && id && request.params?.index !== undefined) {
      const index = Number(request.params.index)
      const view = await sessions.status(id, owner)
      const declared = Number(request.headers.get('content-length'))
      if (Number.isFinite(declared) && declared > view.partBytes)
        return json({ error: `A part is at most ${view.partBytes} bytes.`, code: 'bad-part' }, 413)
      if (!request.arrayBuffer)
        return json({ error: 'This route cannot read a request body.' }, 500)
      return json({ upload: await sessions.receive(id, owner, index, new Uint8Array(await request.arrayBuffer())) })
    }
    if (method === 'GET' && id)
      return json({ upload: await sessions.status(id, owner) })
    if (method === 'DELETE' && id) {
      await sessions.abort(id, owner)
      return json({ ok: true })
    }
    return json({ error: 'Not found' }, 404)
  }
  catch (cause) {
    return uploadSessionResponse(cause)
  }
}

/** A file an action was sent, either way it can come. */
export interface ReceivedUpload {
  name: string
  size: number
  type: string
  /**
   * The finished file on this machine, for a file sent in parts; absent for
   * one that came whole in the request, which is `blob`.
   */
  path?: string
  /** The file itself: a lazy file on disk, or the request's own part. */
  blob: Blob
  /** Whether it arrived through an upload session. */
  fromSession: boolean
  /** Removes a session's file once it has been taken. Does nothing for a file that came whole. */
  discard: () => Promise<void>
}

export interface ReceiveUploadOptions {
  owner: string | number
  sessions: UploadSessions
  /** The multipart field a whole file comes in. Default `file`. */
  field?: string
  /** The field naming an upload session. Default `upload`. */
  sessionField?: string
}

/**
 * The file an action was sent: the multipart `field` (a small file, in one
 * request), or the upload session `sessionField` names (a large one, sent in
 * parts first). Null when the request carries neither. Throws
 * `UploadSessionError` for a session that is not this owner's or not whole;
 * `uploadSessionResponse` answers it.
 */
export async function receiveUpload(request: UploadRouteRequest, options: ReceiveUploadOptions): Promise<ReceivedUpload | null> {
  const session = request.get?.(options.sessionField ?? 'upload')
  if (typeof session === 'string' && session.trim()) {
    const done = await options.sessions.complete(session.trim(), String(options.owner))
    return { name: done.name, size: done.size, type: done.type, path: done.path, blob: Bun.file(done.path), fromSession: true, discard: done.discard }
  }
  const upload = request.file?.(options.field ?? 'file') as (Blob & { name?: string, isValid?: () => boolean }) | undefined
  if (!upload || (typeof upload.isValid === 'function' && !upload.isValid()))
    return null
  return { name: String(upload.name ?? ''), size: upload.size, type: upload.type ?? '', blob: upload, fromSession: false, discard: async () => {} }
}
