import { createHash } from 'node:crypto'

// Independent HTTP verifier, using Node crypto rather than the client's WASM hashes.
export function digestServer() {
  const firstBodies = new Map<string, { bytes: Buffer, contentType: string | null }>()
  const attempts = new Map<string, number>()
  return Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/redirect') return Response.redirect(new URL('/digest/MD5/auth', request.url))
    if (url.pathname === '/empty') return new Response(null, { status: 204 })
    if (url.pathname === '/text') return new Response('healthy', { headers: { 'content-type': 'text/plain' } })
    if (url.pathname === '/problem') return new Response('{"title":"problem"}', { status: 422, headers: { 'content-type': 'application/problem+json' } })
    if (url.pathname === '/invalid') return new Response('invalid', { headers: { 'content-type': 'application/json' } })
    const bytes = Buffer.from(await request.arrayBuffer())
    const authorization = request.headers.get('authorization')
    if (!url.pathname.startsWith('/digest/')) return Response.json({ auth: authorization, query: [...url.searchParams], body: bytes.toString(), accept: request.headers.get('accept'), contentType: request.headers.get('content-type') })
    const [, , algorithm = 'MD5', quality = 'auth'] = url.pathname.split('/')
    const realm = 'test, realm="quoted"'
    const nonce = 'nonce,with=equals'
    const q = (value: string) => `"${value.replace(/[\\"]/g, '\\$&')}"`
    const unicode = url.searchParams.has('unicode')
    const username = unicode ? 'te\u0301st user' : 'user'
    const password = unicode ? 'pa\u0301ss' : 'pass'
    const key = url.pathname + url.search
    attempts.set(key, (attempts.get(key) ?? 0) + 1)
    if (!authorization) {
      firstBodies.set(key, { bytes, contentType: request.headers.get('content-type') })
      let challenge = `Digest ReAlM = ${q(realm)}, NONCE = ${q(nonce)}, algorithm = ${algorithm}, opaque=${q('a,b=c')}${quality === 'legacy' ? '' : `, qop=${q(quality === 'choice' ? 'auth-int, auth' : quality)}`}${url.searchParams.has('userhash') ? ', userhash=true' : ''}${unicode ? ', charset=UTF-8' : ''}${url.searchParams.has('charset') ? `, charset=${url.searchParams.get('charset')}` : ''}`
      if (url.searchParams.get('malformed') === 'duplicate') challenge += ', nonce=\"different\"'
      if (url.searchParams.get('malformed') === 'quote') challenge += ', invalid=\"unterminated'
      // Multiple authentication schemes and algorithms must be parsed independently.
      const alternatives = url.searchParams.has('alternatives') ? 'Basic realm="other", Digest realm="other", nonce="other", algorithm=MD5, qop="auth", ' : ''
      return Response.json({ challenge: true, attempts: attempts.get(key) }, { status: 401, headers: { 'www-authenticate': alternatives + challenge } })
    }
    const fields = Object.fromEntries([...authorization.matchAll(/([\w*]+)=(?:"((?:\\.|[^"\\])*)"|([^,\s]+))/g)].map(match => [match[1], (match[2] ?? match[3] ?? '').replace(/\\(.)/g, '$1')]))
    const hash = (value: string | Buffer) => createHash(algorithm.startsWith('SHA-256') ? 'sha256' : 'md5').update(value).digest('hex')
    let a1 = hash(`${username.normalize('NFC')}:${realm}:${password.normalize('NFC')}`)
    if (algorithm.endsWith('-sess')) a1 = hash(`${a1}:${nonce}:${fields.cnonce}`)
    const uri = url.pathname + url.search
    const qualityUsed = quality === 'choice' ? 'auth' : quality
    const a2 = hash(`${request.method}:${uri}${qualityUsed === 'auth-int' ? `:${hash(bytes)}` : ''}`)
    const expected = hash(quality === 'legacy' ? `${a1}:${nonce}:${a2}` : `${a1}:${nonce}:${fields.nc}:${fields.cnonce}:${qualityUsed}:${a2}`)
    const original = firstBodies.get(key)
    const valid = fields.response === expected && fields.uri === uri && fields.algorithm === algorithm
      && fields.realm === realm && fields.nonce === nonce && fields.opaque === 'a,b=c'
      && (fields.username ?? (fields['username*'] ? decodeURIComponent(fields['username*'].slice(7)) : undefined)) === (url.searchParams.has('userhash') ? hash(`${username.normalize('NFC')}:${realm}`) : username.normalize('NFC'))
      && (quality === 'legacy' || (fields.nc === '00000001' && fields.qop === qualityUsed))
      && original?.bytes.equals(bytes) && original.contentType === request.headers.get('content-type')
    let file: { name: string, text: string } | undefined
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const upload = (await new Response(bytes, { headers: request.headers }).formData()).get('upload')
      if (upload instanceof File) file = { name: upload.name, text: await upload.text() }
    }
    return Response.json({ valid, body: bytes.toString(), file, attempts: attempts.get(key) }, { status: valid ? 200 : 401 })
  } })
}
