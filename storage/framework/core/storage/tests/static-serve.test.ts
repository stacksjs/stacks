/**
 * `serveFile()` answers conditional requests as RFC 9110 section 13.2.2 says.
 *
 *   - A non-matching `If-None-Match` fell through to `If-Modified-Since`, so a
 *     client holding an old copy was told it was current whenever the file's
 *     mtime did not move forward past the date it held.
 *   - `If-None-Match` lists and `*` were compared as one opaque string.
 *   - The millisecond mtime was compared with a second-precision date, so a
 *     client echoing our own `Last-Modified` never got a 304.
 */

import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { serveFile } from '../src/static-serve'

let root: string
let file: string
// Deliberately mid-second, as a real mtime is.
const mtime = new Date('2026-06-15T10:00:00.640Z')

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-serve-'))
  file = join(root, 'app.css')
  writeFileSync(file, 'body { color: red }')
  utimesSync(file, mtime, mtime)
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

function request(headers: Record<string, string> = {}, method = 'GET'): Request {
  return new Request('http://localhost/app.css', { method, headers })
}

async function validators(): Promise<{ etag: string, lastModified: string }> {
  const response = await serveFile(request(), file)
  return { etag: response.headers.get('etag')!, lastModified: response.headers.get('last-modified')! }
}

describe('serveFile conditional requests', () => {
  test('a plain GET is a 200 with both validators', async () => {
    const response = await serveFile(request(), file)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('body { color: red }')
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{16}"$/)
    expect(response.headers.get('last-modified')).toBe('Mon, 15 Jun 2026 10:00:00 GMT')
  })

  test('If-None-Match with the ETag is a 304', async () => {
    const { etag } = await validators()
    expect((await serveFile(request({ 'If-None-Match': etag }), file)).status).toBe(304)
    expect((await serveFile(request({ 'If-None-Match': `W/${etag}` }), file)).status).toBe(304)
  })

  test('the ETag anywhere in a list, or *, is a 304', async () => {
    const { etag } = await validators()
    expect((await serveFile(request({ 'If-None-Match': `"0000000000000000", ${etag}` }), file)).status).toBe(304)
    expect((await serveFile(request({ 'If-None-Match': '*' }), file)).status).toBe(304)
  })

  test('a stale ETag is a 200 even when If-Modified-Since says unchanged', async () => {
    // The stale-copy case: the client's date is later than the file's mtime
    // (a deploy that restored an older mtime), its ETag is not current.
    const response = await serveFile(request({ 'If-None-Match': '"0000000000000000"', 'If-Modified-Since': 'Mon, 15 Jun 2026 11:00:00 GMT' }), file)
    expect(response.status).toBe(200)
  })

  test('If-Modified-Since with our own Last-Modified is a 304', async () => {
    const { lastModified } = await validators()
    expect((await serveFile(request({ 'If-Modified-Since': lastModified }), file)).status).toBe(304)
  })

  test('If-Modified-Since a second earlier is a 200', async () => {
    expect((await serveFile(request({ 'If-Modified-Since': 'Mon, 15 Jun 2026 09:59:59 GMT' }), file)).status).toBe(200)
  })

  test('only GET and HEAD are answered with a 304', async () => {
    const { etag } = await validators()
    expect((await serveFile(request({ 'If-None-Match': etag }, 'HEAD'), file)).status).toBe(304)
    expect((await serveFile(request({ 'If-None-Match': etag }, 'POST'), file)).status).toBe(200)
  })

  test('with ETags off, If-None-Match only matches *', async () => {
    const { lastModified } = await validators()
    expect((await serveFile(request({ 'If-None-Match': '"anything"', 'If-Modified-Since': lastModified }), file, { etag: false })).status).toBe(200)
    expect((await serveFile(request({ 'If-None-Match': '*' }), file, { etag: false })).status).toBe(304)
  })

  test('a missing file is a 404', async () => {
    expect((await serveFile(request(), join(root, 'missing.css'))).status).toBe(404)
  })
})
