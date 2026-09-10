// The Azure Blob Storage driver (stacksjs/stacks#1896).
//
// Azure is the one provider in that issue with no S3-compatible API, so unlike
// R2/GCS/Filebase/Backblaze/Hetzner - which are `s3` disks with a different
// endpoint, and are covered by `s3-compatible-disks.test.ts` - this one speaks
// its own REST surface and needs its own coverage.
//
// `fetch` is replaced with a recording fake rather than a real container. What
// is worth asserting here is the shape of the request the adapter builds - the
// method, the URL, the headers Azure signs over - and that is exactly what a
// live test would hide behind a 201.

import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { AzureBlobStorageAdapter, azureDisk } from '../src'

const ACCOUNT = 'testaccount'
const ACCOUNT_KEY = Buffer.from('a-test-key-not-a-credential').toString('base64')

interface Recorded {
  method: string
  url: URL
  headers: Record<string, string>
  body?: Uint8Array
}

/** Replies the fake returns, in order, for successive requests. */
interface Reply {
  status?: number
  headers?: Record<string, string>
  body?: string | Uint8Array
}

let requests: Recorded[] = []
let replies: Reply[] = []
let realFetch: typeof globalThis.fetch

function reply(next: Reply): void {
  replies.push(next)
}

beforeEach(() => {
  // Saved and restored per test: Bun never rolls a patched global back between
  // files, so leaving this in place would hand every later suite a fake fetch.
  realFetch = globalThis.fetch
  requests = []
  replies = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries((init?.headers ?? {}) as Record<string, string>))
      headers[name.toLowerCase()] = value

    requests.push({
      method: init?.method ?? 'GET',
      url,
      headers,
      body: init?.body as Uint8Array | undefined,
    })

    const next = replies.shift() ?? {}
    const body = typeof next.body === 'string' ? new TextEncoder().encode(next.body) : next.body
    return new Response(body ?? new Uint8Array(), {
      status: next.status ?? 200,
      headers: next.headers,
    })
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function adapter(overrides: Partial<ConstructorParameters<typeof AzureBlobStorageAdapter>[0]> = {}) {
  return new AzureBlobStorageAdapter({
    account: ACCOUNT,
    accountKey: ACCOUNT_KEY,
    container: 'uploads',
    ...overrides,
  })
}

describe('construction', () => {
  it('refuses a disk with nothing to authorize with', () => {
    // The alternative is a disk that constructs fine and fails on its first
    // call, which reads as an outage rather than a missing setting.
    expect(() => new AzureBlobStorageAdapter({ account: ACCOUNT, container: 'uploads' }))
      .toThrow(/accountKey.*sasToken/)
  })

  it('requires an account and a container', () => {
    expect(() => new AzureBlobStorageAdapter({ account: '', container: 'c', accountKey: ACCOUNT_KEY })).toThrow(/account/)
    expect(() => new AzureBlobStorageAdapter({ account: ACCOUNT, container: '', accountKey: ACCOUNT_KEY })).toThrow(/container/)
  })

  it('defaults to the account\'s blob endpoint', async () => {
    reply({ status: 201, headers: { etag: '"0x1"' } })
    await adapter().write('a.txt', 'hi')

    expect(requests[0]?.url.origin).toBe(`https://${ACCOUNT}.blob.core.windows.net`)
  })

  it('honours a custom endpoint, which is what Azurite needs', async () => {
    // The emulator scopes the account by path rather than by subdomain.
    reply({ status: 201 })
    await adapter({ endpoint: 'http://127.0.0.1:10000/devstoreaccount1' }).write('a.txt', 'hi')

    expect(requests[0]?.url.toString()).toBe('http://127.0.0.1:10000/devstoreaccount1/uploads/a.txt')
  })
})

describe('write', () => {
  it('PUTs a block blob with the type header Azure requires', async () => {
    reply({ status: 201, headers: { 'etag': '"0x8DC"', 'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT' } })

    const result = await adapter().write('reports/q1.txt', 'hello')
    const request = requests[0]!

    expect(request.method).toBe('PUT')
    expect(request.url.pathname).toBe('/uploads/reports/q1.txt')
    expect(request.headers['x-ms-blob-type']).toBe('BlockBlob')
    expect(request.headers['content-type']).toBe('text/plain')
    expect(request.headers['content-length']).toBe('5')
    expect(request.headers.authorization).toStartWith(`SharedKey ${ACCOUNT}:`)

    expect(result).toEqual({
      path: 'reports/q1.txt',
      size: 5,
      contentType: 'text/plain',
      etag: '"0x8DC"',
      lastModified: Date.parse('Mon, 01 Jan 2024 00:00:00 GMT'),
    })
  })

  it('applies the disk prefix to the blob name but not to the returned path', async () => {
    // The prefix is how one container holds several disks; a caller that wrote
    // `a.txt` should not have to know about it to read the result back.
    reply({ status: 201 })
    const result = await adapter({ prefix: 'tenant-7' }).write('a.txt', 'hi')

    expect(requests[0]?.url.pathname).toBe('/uploads/tenant-7/a.txt')
    expect(result.path).toBe('a.txt')
  })

  it('encodes each path segment separately, so slashes stay slashes', async () => {
    // Encoding the whole name would escape the separators and leave Azure
    // holding one blob literally called `a%2Fb.txt`.
    reply({ status: 201 })
    await adapter().write('a folder/b&c.txt', 'hi')

    expect(requests[0]?.url.pathname).toBe('/uploads/a%20folder/b%26c.txt')
  })

  it('surfaces Azure\'s error code and message, not just the status', async () => {
    reply({ status: 403, body: '<?xml version="1.0"?><Error><Code>AuthenticationFailed</Code><Message>Server failed to authenticate the request.\nTime:2024</Message></Error>' })

    await expect(adapter().write('a.txt', 'hi')).rejects.toThrow(/403 \(AuthenticationFailed\): Server failed to authenticate/)
  })
})

describe('read', () => {
  it('GETs the blob and returns its bytes unchanged', async () => {
    const bytes = new Uint8Array([0xFF, 0x00, 0xFE, 0x80])
    reply({ status: 200, body: bytes })

    const result = await adapter().readToBuffer('binary.bin')

    expect(requests[0]?.method).toBe('GET')
    expect(new Uint8Array(result)).toEqual(bytes)
  })

  it('does not decode as text, which would corrupt every non-UTF-8 file', async () => {
    // The exact bug the S3 adapter carried: a decode-then-re-encode round trip
    // turns each invalid sequence into U+FFFD and changes the file's length.
    const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0xFF, 0xD8])
    reply({ status: 200, body: bytes })

    expect((await adapter().readToBuffer('a.png')).byteLength).toBe(bytes.byteLength)
  })

  it('reads a stream incrementally rather than buffering', async () => {
    reply({ status: 200, body: 'streamed' })
    const stream = await adapter().getStream('a.txt')

    expect(stream).toBeInstanceOf(ReadableStream)
    const reader = stream.getReader()
    const { value } = await reader.read()
    expect(new TextDecoder().decode(value)).toBe('streamed')
  })
})

describe('putStream', () => {
  it('stages blocks and commits them in one block list', async () => {
    // Two 4-byte blocks with a 4-byte block size, then the commit.
    reply({ status: 201 })
    reply({ status: 201 })
    reply({ status: 201, headers: { etag: '"0x9"' } })

    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('aaaa'))
        controller.enqueue(new TextEncoder().encode('bbbb'))
        controller.close()
      },
    })

    const result = await adapter().putStream('big.bin', source, { partSize: 4 })

    expect(requests).toHaveLength(3)
    expect(requests[0]?.url.searchParams.get('comp')).toBe('block')
    expect(requests[1]?.url.searchParams.get('comp')).toBe('block')
    expect(requests[2]?.url.searchParams.get('comp')).toBe('blocklist')
    expect(result.size).toBe(8)
    expect(result.etag).toBe('"0x9"')
  })

  it('gives every block an equal-length id, which Azure requires', async () => {
    // Eleven blocks, so the counter crosses from one digit to two: an unpadded
    // id would be the same length for the first ten and longer for the
    // eleventh, and Azure rejects the commit outright.
    for (let i = 0; i < 12; i++)
      reply({ status: 201 })

    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 11; i++)
          controller.enqueue(new TextEncoder().encode('x'))
        controller.close()
      },
    })
    await adapter().putStream('big.bin', source, { partSize: 1 })

    const ids = requests.slice(0, 11).map(r => r.url.searchParams.get('blockid')!)
    expect(ids).toHaveLength(11)
    expect(new Set(ids).size).toBe(11)
    expect(new Set(ids.map(id => id.length)).size).toBe(1)
    expect(new Set(ids.map(id => Buffer.from(id, 'base64').length)).size).toBe(1)
  })

  it('commits the blocks in the order they were staged', async () => {
    reply({ status: 201 })
    reply({ status: 201 })
    reply({ status: 201 })

    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('11'))
        controller.enqueue(new TextEncoder().encode('22'))
        controller.close()
      },
    })
    await adapter().putStream('big.bin', source, { partSize: 2 })

    const staged = requests.slice(0, 2).map(r => r.url.searchParams.get('blockid')!)
    const committed = new TextDecoder().decode(requests[2]!.body)

    expect(committed).toBe(
      `<?xml version="1.0" encoding="utf-8"?><BlockList><Latest>${staged[0]}</Latest><Latest>${staged[1]}</Latest></BlockList>`,
    )
  })
})

describe('list', () => {
  const listing = (blobs: string[], prefixes: string[] = [], nextMarker = ''): string =>
    `<?xml version="1.0"?><EnumerationResults><Blobs>${
      blobs.map(name => `<Blob><Name>${name}</Name></Blob>`).join('')
    }${
      prefixes.map(name => `<BlobPrefix><Name>${name}</Name></BlobPrefix>`).join('')
    }</Blobs><NextMarker>${nextMarker}</NextMarker></EnumerationResults>`

  it('yields blobs, and folds a shallow listing into directories', async () => {
    reply({ status: 200, body: listing(['docs/a.txt'], ['docs/nested/']) })

    const entries = []
    for await (const entry of adapter().list('docs'))
      entries.push(entry)

    expect(entries).toEqual([
      { path: 'docs/a.txt', type: 'file' },
      { path: 'docs/nested', type: 'directory' },
    ])
    expect(requests[0]?.url.searchParams.get('delimiter')).toBe('/')
    expect(requests[0]?.url.searchParams.get('prefix')).toBe('docs/')
  })

  it('drops the delimiter for a deep listing', async () => {
    reply({ status: 200, body: listing(['docs/a/b.txt']) })

    for await (const _entry of adapter().list('docs', { deep: true })) { /* drain */ }

    expect(requests[0]?.url.searchParams.has('delimiter')).toBeFalse()
  })

  it('handles a container holding exactly one blob', async () => {
    // XML cannot say "a list of one", so a single <Blob> parses to an object
    // rather than an array. Iterating that unnormalized walks the name's keys.
    reply({ status: 200, body: listing(['only.txt']) })

    const entries = []
    for await (const entry of adapter().list(''))
      entries.push(entry)

    expect(entries).toEqual([{ path: 'only.txt', type: 'file' }])
  })

  it('follows the continuation marker', async () => {
    reply({ status: 200, body: listing(['a.txt'], [], 'marker-2') })
    reply({ status: 200, body: listing(['b.txt']) })

    const entries = []
    for await (const entry of adapter().list(''))
      entries.push(entry.path)

    expect(entries).toEqual(['a.txt', 'b.txt'])
    expect(requests[1]?.url.searchParams.get('marker')).toBe('marker-2')
  })

  it('strips the disk prefix from what it yields', async () => {
    reply({ status: 200, body: listing(['tenant-7/a.txt']) })

    const entries = []
    for await (const entry of adapter({ prefix: 'tenant-7' }).list(''))
      entries.push(entry.path)

    expect(entries).toEqual(['a.txt'])
  })
})

describe('visibility', () => {
  it('reports the container\'s public access level', async () => {
    reply({ status: 200, headers: { 'x-ms-blob-public-access': 'blob' } })
    expect(await adapter().visibility('a.txt')).toBe('public')

    reply({ status: 200 })
    expect(await adapter().visibility('a.txt')).toBe('private')
  })

  it('refuses to change it, because Azure has no per-blob ACL', async () => {
    // Silently doing nothing is how a caller comes to believe a file is served
    // publicly when it is not; flipping the container would expose its
    // neighbours. Refusing names the SAS path instead.
    await expect(adapter().changeVisibility('a.txt', 'public')).rejects.toThrow(/container, not the blob/)
    expect(requests).toHaveLength(0)
  })
})

describe('copy and move', () => {
  it('copies server-side, naming the source blob', async () => {
    reply({ status: 202, headers: { 'x-ms-copy-status': 'success' } })
    await adapter().copyFile('a.txt', 'b.txt')

    expect(requests[0]?.url.pathname).toBe('/uploads/b.txt')
    expect(requests[0]?.headers['x-ms-copy-source']).toContain('/uploads/a.txt')
  })

  it('does not report success for a copy that is still pending', async () => {
    reply({ status: 202, headers: { 'x-ms-copy-status': 'pending' } })
    await expect(adapter().copyFile('a.txt', 'b.txt')).rejects.toThrow(/did not complete synchronously/)
  })

  it('moves by copying then deleting the source', async () => {
    reply({ status: 202, headers: { 'x-ms-copy-status': 'success' } })
    reply({ status: 202 })
    await adapter().moveFile('a.txt', 'b.txt')

    expect(requests.map(r => `${r.method} ${r.url.pathname}`)).toEqual([
      'PUT /uploads/b.txt',
      'DELETE /uploads/a.txt',
    ])
  })
})

describe('signed URLs', () => {
  it('mints a read SAS on the blob\'s own URL', async () => {
    const url = new URL(await adapter().signedUrl('reports/q1.pdf', { expiresIn: 3600 }))

    expect(url.pathname).toBe('/uploads/reports/q1.pdf')
    expect(url.searchParams.get('sp')).toBe('r')
    expect(url.searchParams.get('sr')).toBe('b')
    expect(url.searchParams.get('sig')).toBeTruthy()
    // Signing is local; nothing was asked of Azure.
    expect(requests).toHaveLength(0)
  })

  it('rejects a lifetime outside the range Azure accepts', async () => {
    await expect(adapter().signedUrl('a.txt', { expiresIn: 30 })).rejects.toThrow(RangeError)
    await expect(adapter().signedUrl('a.txt', { expiresIn: 8 * 24 * 3600 })).rejects.toThrow(RangeError)
  })

  it('refuses to sign on a SAS-token disk rather than re-serving the token', async () => {
    // Handing the configured token back as a "signed URL" would grant whatever
    // it grants, to whoever the URL reaches.
    const sasDisk = new AzureBlobStorageAdapter({ account: ACCOUNT, container: 'uploads', sasToken: '?sv=2020-12-06&sig=x' })

    await expect(sasDisk.signedUrl('a.txt', { expiresIn: 3600 })).rejects.toThrow(/needs the account key/)
  })

  it('appends the configured SAS token to ordinary requests', async () => {
    reply({ status: 201 })
    const sasDisk = new AzureBlobStorageAdapter({ account: ACCOUNT, container: 'uploads', sasToken: 'sv=2020-12-06&sig=abc' })
    await sasDisk.write('a.txt', 'hi')

    expect(requests[0]?.url.searchParams.get('sig')).toBe('abc')
    expect(requests[0]?.headers.authorization).toBeUndefined()
  })
})

describe('presignedUploadUrl', () => {
  it('grants create and write, and echoes what the client must send', async () => {
    const result = await adapter().presignedUploadUrl({
      contentType: 'image/png',
      expiresIn: 3600,
      dir: 'avatars',
      filename: 'me.png',
    })

    expect(result.path).toBe('avatars/me.png')
    expect(result.key).toBe('avatars/me.png')
    expect(result.contentType).toBe('image/png')
    expect(new URL(result.url).searchParams.get('sp')).toBe('cw')
  })

  it('derives a filename from the content type when none is given', async () => {
    const result = await adapter().presignedUploadUrl({ contentType: 'application/pdf', expiresIn: 3600 })

    expect(result.path).toMatch(/^[0-9a-f]{32}\.pdf$/)
  })

  it('refuses a directory that would escape the disk', async () => {
    // A blob name is an opaque string, so `..` lands verbatim rather than
    // resolving away (stacksjs/stacks#1873 S-1).
    await expect(adapter().presignedUploadUrl({
      contentType: 'image/png',
      expiresIn: 3600,
      dir: '../../secrets',
    })).rejects.toThrow()
  })
})

describe('azureDisk', () => {
  it('builds an azure disk rather than an s3 one with an endpoint', () => {
    // The distinction that makes this a driver at all: Azure has no
    // S3-compatible API, unlike every other provider in #1896.
    const disk = azureDisk('uploads', ACCOUNT, { accountKey: ACCOUNT_KEY })

    expect(disk.driver).toBe('azure')
    expect(disk.account).toBe(ACCOUNT)
    expect(disk.container).toBe('uploads')
    expect(disk.visibility).toBe('private')
  })

  it('lets callers override every field', () => {
    const disk = azureDisk('media', ACCOUNT, {
      prefix: 'tenant-7',
      url: 'https://cdn.example.com',
      endpoint: 'http://127.0.0.1:10000/devstoreaccount1',
      visibility: 'public',
    })

    expect(disk.prefix).toBe('tenant-7')
    expect(disk.url).toBe('https://cdn.example.com')
    expect(disk.endpoint).toBe('http://127.0.0.1:10000/devstoreaccount1')
    expect(disk.visibility).toBe('public')
  })
})

describe('publicUrl', () => {
  it('derives from the blob endpoint, which serves public containers', async () => {
    // Unlike R2, where the API host never serves objects and a derived URL
    // would be silently broken.
    expect(await adapter().publicUrl('img/logo.png'))
      .toBe(`https://${ACCOUNT}.blob.core.windows.net/uploads/img/logo.png`)
  })

  it('prefers the configured base URL, then an explicit domain', async () => {
    const disk = adapter({ url: 'https://cdn.example.com/' })

    expect(await disk.publicUrl('img/logo.png')).toBe('https://cdn.example.com/img/logo.png')
    expect(await disk.publicUrl('img/logo.png', { domain: 'https://other.example.com' }))
      .toBe('https://other.example.com/img/logo.png')
  })

  it('includes the disk prefix, since that is where the blob is', async () => {
    expect(await adapter({ prefix: 'tenant-7', url: 'https://cdn.example.com' }).publicUrl('a.png'))
      .toBe('https://cdn.example.com/tenant-7/a.png')
  })
})
