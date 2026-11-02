import type { fetcher } from '../../src/fetcher'

function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
}

/** Runs unchanged in Bun and a real browser against the independent HTTP verifier. */
export async function exerciseClient(client: typeof fetcher, base: string): Promise<void> {
  for (const algorithm of ['MD5', 'SHA-256', 'MD5-sess', 'SHA-256-sess']) {
    for (const quality of ['auth', 'auth-int', 'legacy', 'choice']) {
      const response = await client.withDigestAuth('user', 'pass').withBody({ payload: 'é & = kept' }).post<{ valid: boolean }>(`${base}/digest/${algorithm}/${quality}?test=matrix#fragment`)
      if (response.status !== 200) throw new Error(`${algorithm}/${quality}: ${JSON.stringify(response.data)}`)
      equal(response.data.valid, true)
    }
  }
  for (const suffix of ['?userhash=1', '?alternatives=1']) {
    equal((await client.withDigestAuth('user', 'pass').get(`${base}/digest/SHA-256/auth${suffix}`)).status, 200)
  }
  for (const suffix of ['?unicode=1', '?unicode=1&userhash=1']) {
    equal((await client.withDigestAuth('te\u0301st user', 'pa\u0301ss').get(`${base}/digest/SHA-256/auth${suffix}`)).status, 200)
  }
  const concurrent = await Promise.all(['first', 'second'].map(label => client.withDigestAuth('user', 'pass').withBody({ label }).post(`${base}/digest/MD5/auth-int?concurrent=${label}`)))
  equal(concurrent.map(response => response.status), [200, 200])
  const form = await client.withDigestAuth('user', 'pass').asForm().withBody({ name: 'a & b', skip: null }).post<{ body: string }>(`${base}/digest/MD5/auth-int?form`)
  equal(form.status, 200)
  equal(form.data.body, 'name=a+%26+b')
  const multipart = await client.withDigestAuth('user', 'pass').attach('upload', 'actual file bytes', 'proof.txt').withBody({ caption: 'kept' }).post<{ file: { name: string, text: string } }>(`${base}/digest/SHA-256/auth-int?multipart`)
  equal(multipart.status, 200)
  equal(multipart.data.file, { name: 'proof.txt', text: 'actual file bytes' })
  for (const unsupported of ['SHA-512/auth', 'MD5/unknown']) {
    const response = await client.withDigestAuth('user', 'pass').get<{ attempts: number }>(`${base}/digest/${unsupported}?unsupported`)
    equal(response.status, 401)
    equal(response.data.attempts, 1)
  }
  for (const suffix of ['?charset=UTF-16', '?malformed=duplicate', '?malformed=quote']) {
    const response = await client.withDigestAuth('user', 'pass').get<{ attempts: number }>(`${base}/digest/MD5/auth${suffix}`)
    equal(response.status, 401)
    equal(response.data.attempts, 1)
  }
  equal((await client.withDigestAuth('user', 'pass').get(`${base}/redirect`)).status, 401)
  const [a, b] = await Promise.all([
    client.withToken('A').asForm().post<{ auth: string, body: string }>(`${base}/echo`, { a: 1 }),
    client.withToken('B').post<{ auth: string, body: string }>(`${base}/echo`, { b: 2 }),
  ])
  equal(a.data.auth, 'Bearer A'); equal(b.data.auth, 'Bearer B')
  equal(a.data.body, 'a=1'); equal(b.data.body, '{"b":2}')
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic
  let rejected = false
  try { await client.withToken('discard').withHeaders({ Accept: 'text/plain' }).post(`${base}/echo`, cyclic) }
  catch { rejected = true }
  equal(rejected, true)
  const clean = await client.get<{ auth: null, accept: string, contentType: string }>(`${base}/echo`)
  equal(clean.data.auth, null); equal(clean.data.accept, 'application/json'); equal(clean.data.contentType, 'application/json')
  try { await client.withToken('discard').get('http://127.0.0.1:1/unreachable') }
  catch { /* A transport failure must consume the request configuration too. */ }
  equal((await client.get<{ auth: null }>(`${base}/echo`)).data.auth, null)
  equal((await client.withHeaders({ 'CONTENT-TYPE': 'first' }).withHeaders({ 'content-type': 'last' }).post<{ contentType: string }>(`${base}/echo`, {})).data.contentType, 'last')
  equal((await client.withQueryParams({ tag: 'new & =', skip: undefined }).get<{ query: string[][] }>(`${base}/echo?tag=old#section`)).data.query, [['tag', 'old'], ['tag', 'new & =']])
  equal((await client.delete(`${base}/empty`)).data, null)
  equal((await client.accept('text/plain').get(`${base}/text`)).data, 'healthy')
  equal((await client.get(`${base}/problem`)).data, { title: 'problem' })
  rejected = false
  try { await client.withToken('discard').get(`${base}/invalid`) }
  catch { rejected = true }
  equal(rejected, true)
  equal((await client.get<{ auth: null }>(`${base}/echo`)).data.auth, null)
}
