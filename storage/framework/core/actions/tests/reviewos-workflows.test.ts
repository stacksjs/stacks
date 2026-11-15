import { expect, test } from 'bun:test'
import { reviewOsWorkflows } from '../src/reviewos-workflows'

test('a private workflow uses the public API, follows cursors and keeps exact run/source identities', async () => {
  const seen: Array<{ method: string, path: string, query: Record<string, string>, auth: string | null, body: unknown }> = []
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const url = new URL(request.url)
    seen.push({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: request.headers.get('authorization'), body: request.method === 'POST' ? await request.json() : null })
    if (url.pathname.endsWith('/workflows')) return Response.json({ workflows: [{ id: 7, path: '.reviewos/workflows/ci.yml', owner_defined: false }], next: null })
    if (url.pathname.endsWith('/workflow-runs')) return Response.json(url.searchParams.has('cursor') ? { workflow_runs: [{ number: 41, head_sha: 'a'.repeat(40), state: 'failed' }], next: null } : { workflow_runs: [{ number: 42, head_sha: 'a'.repeat(40), state: 'succeeded' }], next: 'opaque+cursor' })
    if (url.pathname.endsWith('/workflow-runs/show')) return Response.json({ workflow_run: { number: 42, head_sha: 'a'.repeat(40), ref: 'refs/heads/main', trusted: true, state: 'succeeded', jobs: [{ job_id: 'acceptance', state: 'succeeded' }] } })
    if (url.pathname.endsWith('/workflows/dispatch')) return Response.json({ workflow_run: { number: 43, state: 'queued' } }, { status: 201 })
    if (url.pathname.endsWith('/artifacts')) return Response.json({ artifacts: [{ id: 5, name: 'simulator', digest: 'c'.repeat(64), size_bytes: 123 }] })
    return Response.json({ error: 'missing' }, { status: 404 })
  } })
  const client = reviewOsWorkflows({ origin: 'https://forge.example', repository: 'owner/private-app', token: 'fixture-read-key', fetch: (input, init) => fetch(String(input).replace('https://forge.example', `http://127.0.0.1:${server.port}`), init) })
  try {
    const runs = await client.runs('ci.yml', { branch: 'main', sha: 'a'.repeat(40) })
    expect(runs.map(run => run.number)).toEqual([42, 41])
    expect((await client.run(42)).head_sha).toBe('a'.repeat(40))
    expect((await client.dispatch('release-ios.yml', 'main', { upload: false })).number).toBe(43)
    expect((await client.artifacts(42))[0]).toMatchObject({ id: 5, digest: 'c'.repeat(64), size_bytes: 123 })
    expect(seen.every(request => request.auth === 'Bearer fixture-read-key')).toBe(true)
    expect(seen.every(request => request.query.owner === 'owner' && request.query.repo === 'private-app' || request.method === 'POST')).toBe(true)
    expect(seen.find(request => request.query.cursor)?.query.cursor).toBe('opaque+cursor')
    expect(seen.find(request => request.method === 'POST')?.body).toEqual({ owner: 'owner', repo: 'private-app', workflow: '.reviewos/workflows/release-ios.yml', ref: 'main', inputs: { upload: false } })
  }
  finally { server.stop(true) }
})

test('a malformed or looping metadata response never becomes successful release evidence', async () => {
  let requests = 0
  const client = reviewOsWorkflows({ origin: 'https://forge.example', repository: 'owner/app', fetch: async () => { requests++; return Response.json({ workflows: [], next: 'same' }) } })
  await expect(client.runs('ci.yml')).rejects.toThrow('pagination')
  expect(requests).toBe(2)
  expect(() => reviewOsWorkflows({ origin: 'https://secret@outside.invalid', repository: 'owner/app' })).toThrow()
  expect(() => reviewOsWorkflows({ origin: 'https://forge.example', repository: '../app' })).toThrow()
  const bad = reviewOsWorkflows({ origin: 'https://forge.example', repository: 'owner/app', fetch: async () => Response.json({ workflow_run: { number: 99, state: 'succeeded' } }) })
  await expect(bad.run(42)).rejects.toThrow('identity')
  await expect(bad.dispatch('../release.yml', 'main')).rejects.toThrow()
})
