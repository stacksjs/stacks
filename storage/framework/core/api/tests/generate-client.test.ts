/**
 * The generated client.
 *
 * Asserted against documents built here rather than against the framework's
 * own, because the interesting shapes - a path parameter, an optional query,
 * a colliding operationId - are exactly the ones a given app happens not to
 * have on the day you write the generator.
 *
 * The client is generated *text*, so most of these read it as a string. The
 * last block goes further and evaluates it against a fake fetch, because
 * "the output contains the right code" and "the output works" are different
 * claims and only the second one is the point.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { methodName, renderApiClient } from '../src/generate-client'

const scratches: string[] = []

afterAll(() => {
  for (const scratch of scratches) rmSync(scratch, { recursive: true, force: true })
})

/**
 * Import the generated client the way a consumer would: as a file.
 *
 * Not a `data:` URL - Bun's resolver refuses one this long with ENAMETOOLONG,
 * and the whole claim being tested is that this text is a module somebody can
 * put in their project.
 *
 * A fresh directory per call, because the resolver caches a directory's
 * listing: the second file written into an already-imported directory does not
 * exist as far as `import` is concerned, and fails as "Cannot find module" for
 * a file plainly on disk.
 */
async function evaluate(document: any) {
  const scratch = mkdtempSync(join(tmpdir(), 'stacks-api-client-'))
  scratches.push(scratch)

  const file = join(scratch, 'client.ts')
  writeFileSync(file, renderApiClient(document))

  return await import(file)
}

function documentWith(paths: Record<string, unknown>) {
  return { openapi: '3.0.0', info: { title: 'Test API', version: '1' }, paths } as any
}

const showOperation = {
  operationId: 'get__api_repos_show',
  parameters: [
    { name: 'owner', in: 'query', required: true, schema: { type: 'string' } },
    { name: 'page', in: 'query', required: false, schema: { type: 'integer' } },
  ],
  responses: {
    200: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } } },
  },
}

describe('naming', () => {
  it('turns a generated operationId into something a person would type', () => {
    expect(methodName('get__api_repos_pulls_show')).toBe('getReposPullsShow')
  })

  it('keeps a route name that already reads well', () => {
    expect(methodName('posts.store')).toBe('postsStore')
  })

  it('drops `api` only where every route shares it', () => {
    // A segment genuinely called `api` deeper in the path is part of the name,
    // or two different endpoints collapse onto one method.
    expect(methodName('get__api_settings_api_keys')).toBe('getSettingsApiKeys')
  })

  it('folds a path parameter into the name rather than numbering it', () => {
    // `getRepository` and `getRepositoryById` are different operations, and
    // `getRepository2` tells the reader nothing about which is which.
    expect(methodName('get__api_repositories_{id}')).toBe('getRepositoriesId')
  })

  it('never emits an identifier that starts with a digit', () => {
    expect(methodName('2fa_verify')).toMatch(/^[a-z_$]/i)
  })
})

describe('the rendered client', () => {
  it('takes required arguments and makes the rest optional', () => {
    const client = renderApiClient(documentWith({ '/api/repos/show': { get: showOperation } }))

    expect(client).toContain('"owner": string')
    expect(client).toContain('"page"?: number')
  })

  it('types the response from the document', () => {
    const client = renderApiClient(documentWith({ '/api/repos/show': { get: showOperation } }))

    expect(client).toContain('ApiResult<{ "name": string }>')
  })

  it('makes the whole argument optional when nothing in it is required', () => {
    const client = renderApiClient(documentWith({
      '/api/queue': {
        get: { operationId: 'get__api_queue', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }], responses: {} },
      },
    }))

    // Otherwise `client.getQueue()` - the overwhelmingly common call - is a
    // type error demanding an empty object.
    expect(client).toContain('input?: {')
  })

  it('treats a path parameter as required even when the document does not say so', () => {
    const client = renderApiClient(documentWith({
      '/api/repos/{id}': {
        get: { operationId: 'get__api_repos_{id}', parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }], responses: {} },
      },
    }))

    // A URL with `{id}` still in it is a 404 whose message is about the
    // literal string.
    expect(client).toContain('"id": string')
    expect(client).not.toContain('"id"?: string')
  })

  it('keeps both operations when two names collide', () => {
    const client = renderApiClient(documentWith({
      '/api/a': { get: { operationId: 'thing', responses: {} } },
      '/api/b': { get: { operationId: 'thing', responses: {} } },
    }))

    // Dropping one would leave the client quietly unable to call an endpoint
    // that exists, which is the failure a generated client is meant to prevent.
    expect(client).toContain('  thing(')
    expect(client).toContain('  thing2(')
  })

  it('imports nothing', () => {
    const client = renderApiClient(documentWith({ '/api/repos/show': { get: showOperation } }))

    // A generated client that needs a runtime package pins its consumer to
    // this framework's release cadence, which is the coupling it exists to
    // remove.
    expect(client).not.toMatch(/^import /m)
    expect(client).not.toMatch(/require\(/)
  })
})

describe('the client, actually running', () => {
  /** Evaluate the generated module and hand it a fetch that records. */
  async function load(document: any) {
    const module = await evaluate(document)

    const calls: Array<{ url: string, init: any }> = []
    const client = module.createClient({
      baseUrl: 'https://example.test',
      token: 'tok_1',
      fetch: async (url: string, init: any) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ name: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    })

    return { client, calls }
  }

  it('puts query arguments in the URL and sends the token', async () => {
    const { client, calls } = await load(documentWith({ '/api/repos/show': { get: showOperation } }))

    const result = await client.getReposShow({ owner: 'acme' })

    expect(calls[0]?.url).toBe('https://example.test/api/repos/show?owner=acme')
    expect(calls[0]?.init.headers.Authorization).toBe('Bearer tok_1')
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ name: 'ok' })
  })

  it('leaves an absent argument out rather than sending it empty', async () => {
    const { client, calls } = await load(documentWith({ '/api/repos/show': { get: showOperation } }))

    await client.getReposShow({ owner: 'acme', page: undefined })

    // `?page=` asks for page number empty-string, which is a different
    // question from not paging.
    expect(calls[0]?.url).not.toContain('page')
  })

  it('substitutes a path parameter instead of appending it', async () => {
    const { client, calls } = await load(documentWith({
      '/api/repos/{id}': {
        get: { operationId: 'get__api_repos_{id}', parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }], responses: {} },
      },
    }))

    await client.getReposId({ id: 'a b' })

    expect(calls[0]?.url).toBe('https://example.test/api/repos/a%20b')
  })

  it('sends a body as JSON on a write', async () => {
    const { client, calls } = await load(documentWith({
      '/api/repos': {
        post: {
          operationId: 'post__api_repos',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } } },
          responses: {},
        },
      },
    }))

    await client.postRepos({ body: { name: 'new' } })

    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.body).toBe('{"name":"new"}')
    expect(calls[0]?.init.headers['Content-Type']).toBe('application/json')
  })

  it('does not throw on a refusal', async () => {
    const module = await evaluate(documentWith({ '/api/repos/show': { get: showOperation } }))

    const client = module.createClient({
      baseUrl: 'https://example.test',
      fetch: async () => new Response(JSON.stringify({ error: 'nope' }), { status: 403 }),
    })

    /*
     * An API where every refusal is an exception forces a try/catch around
     * normal control flow, and the catch that results swallows the real
     * failures too.
     */
    const result = await client.getReposShow({ owner: 'acme' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
    expect(result.error).toEqual({ error: 'nope' })
  })

  it('keeps a non-JSON body verbatim', async () => {
    const module = await evaluate(documentWith({ '/api/repos/show': { get: showOperation } }))

    const client = module.createClient({
      baseUrl: 'https://example.test',
      fetch: async () => new Response('<html>gateway timeout</html>', { status: 504 }),
    })

    // An endpoint that answered with HTML is worth seeing. Replacing it with a
    // parse error hides the only evidence of what went wrong.
    const result = await client.getReposShow({ owner: 'acme' })

    expect(String(result.error)).toContain('gateway timeout')
  })
})
