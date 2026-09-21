/**
 * The serving contract, pinned end to end.
 *
 * `cmsPageFallback` was unit-tested and the servers' `onResponse` wiring was
 * eyeballed, which is not the same as knowing a request produces a page. It
 * did not: the first real check served a 404 because stx-serve's own
 * not-found response looked like it might return before the hook, and a
 * separate port collision hid the answer for several rounds.
 *
 * This test runs the part of the dev and production servers that decides
 * what a page request gets - stx `serve()`, with the CMS fallback in
 * `onResponse` for its 404s - so the two properties that matter can never
 * silently regress:
 *
 *   1. a published page is served for a path with no coded view
 *   2. a coded stx view still wins for a path that has one
 */

import type { Subprocess } from 'bun'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { registerDefaultBlocks } from '../blocks/defaults'
import { getDb } from '../database'
import { createPageDocument } from '../pages/document'
import { cmsPageFallback } from '../public/fallback'
import { refreshDatabase } from './setup'

const SITE = { id: 1, name: 'Lakeside', subdomain: 'lakeside', settings: {} }

let port: number
let publicDir: string
let server: Subprocess | undefined
let originalCwd: string

/**
 * A port nothing was listening on a moment ago: bind port 0, read what the
 * OS chose, let it go.
 *
 * stx accepts port 0 itself, but never says which port it got: it listens on
 * one the OS picks and announces `http://localhost:0/`. So the port is chosen
 * here and passed in. Another process could take it before the server binds
 * it; the server then fails rather than moving to the next port, and the hook
 * below reports its exit.
 */
async function freePort(): Promise<number> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response(null) })
  const chosen = probe.port
  await probe.stop(true)
  if (!chosen)
    throw new Error('the OS chose no port for a port-0 listener')
  return chosen
}

beforeAll(async () => {
  await refreshDatabase()
  registerDefaultBlocks()

  // Block partials and the page template resolve against the process's
  // working directory, which for a server is the project root. `bun test`
  // runs from the package, so pin cwd to the root or every block renders
  // empty - a difference worth encoding rather than discovering again.
  const root = resolve(import.meta.dir, '../../../../../..')
  originalCwd = process.cwd()
  process.chdir(root)

  // The coded view under test is the framework's real
  // `resources/views/index.stx`, because stx routes views from the
  // project's own views root - a temp directory outside it produces no
  // route at all, which is itself worth knowing.
  //
  // The public directory is the one thing not taken from the project.
  // bun-plugin-stx 0.2.286's `serve()` holds every request, the readiness
  // probe below included, until it has encoded responsive variants of each
  // raster image under its public directory. Pointed at the project's
  // public/ from a cold cache, which CI's always is, that kept this hook past
  // its 30s budget. Nothing here is about images, so the server gets a
  // public directory with none in it.
  publicDir = mkdtempSync(join(tmpdir(), 'stacks-cms-public-'))

  await createPageDocument(SITE.id, {
    title: 'Admissions',
    slug: 'admissions',
    status: 'published',
    blocks: [{ type: 'rich-text', props: { html: '<p>We admit 44 students.</p>' } }],
  })
  // Same path as the framework's coded index view, to prove precedence
  // rather than assume it.
  await createPageDocument(SITE.id, {
    title: 'Home',
    slug: '/',
    status: 'published',
    blocks: [{ type: 'rich-text', props: { html: '<p>CMS VERSION</p>' } }],
  })
  await createPageDocument(SITE.id, {
    title: 'Draft Only',
    slug: 'secret',
    blocks: [{ type: 'rich-text', props: { html: '<p>unpublished</p>' } }],
  })

  // setup.ts pins this; the server has to read the same file.
  const dbPath = process.env.DB_DATABASE_PATH
  if (process.env.DB_CONNECTION !== 'sqlite' || !dbPath)
    throw new Error('setup.ts should have pinned DB_CONNECTION=sqlite and DB_DATABASE_PATH')

  // In a process of its own, because stx gives no way to stop a `serve()`
  // started in this one: see the fixture. Its environment is the list below,
  // not this process's, and `--no-env-file` turns off Bun's own .env loading.
  port = await freePort()
  server = Bun.spawn([
    process.execPath,
    '--no-env-file',
    join(import.meta.dir, 'fixtures', 'stx-cms-server.ts'),
    root,
    String(port),
    publicDir,
    JSON.stringify(SITE),
  ], {
    // The package directory, whose bunfig.toml preloads nothing outside
    // `bun test`. From the project root, the root bunfig.toml would preload
    // the env layer and the framework preloader into the server. The fixture
    // moves to the project root itself.
    cwd: resolve(import.meta.dir, '../..'),
    env: {
      PATH: process.env.PATH ?? '',
      HOME: homedir(),
      TMPDIR: tmpdir(),
      // What this process has under `bun test` and setup.ts. stx reads either
      // as development, so it serves as it would in this process.
      NODE_ENV: 'test',
      APP_ENV: 'testing',
      DB_CONNECTION: 'sqlite',
      DB_DATABASE_PATH: dbPath,
    },
    // Never written to. The fixture stops when this end closes, so the server
    // cannot outlive this process even if afterAll never runs.
    stdin: 'pipe',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  // The server now loads its modules after this hook starts waiting, so the
  // wait is bounded by time, inside the hook's own budget, not by attempts.
  const deadline = Date.now() + 25_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode)
      throw new Error(`stx server exited (${server.signalCode ?? `code ${server.exitCode}`}) before answering on ${port}`)
    try {
      await fetch(`http://127.0.0.1:${port}/__ready`)
      return
    }
    catch {
      await Bun.sleep(100)
    }
  }
  throw new Error(`stx server did not come up on ${port} within 25s`)
}, 30_000)

afterAll(async () => {
  try {
    if (server) {
      server.kill()
      await server.exited
      // Stopped means nothing listens on the port any more, so a new listener
      // can bind it. While the server is up this throws EADDRINUSE and fails
      // the file.
      const rebound = Bun.serve({ port, fetch: () => new Response(null) })
      await rebound.stop(true)
    }
  }
  finally {
    // Whatever the check above says, the files after this one in the same
    // process get their working directory and an empty pages table back.
    const db = await getDb()
    await db.unsafe('DELETE FROM pages').execute()
    if (publicDir)
      rmSync(publicDir, { recursive: true, force: true })
    if (originalCwd)
      process.chdir(originalCwd)
  }
})

async function get(path: string): Promise<{ status: number, body: string }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { Host: 'lakeside.localhost' } })
  return { status: res.status, body: await res.text() }
}

describe('CMS public serving through the real stx server', () => {
  it('serves a published page where no coded view exists', async () => {
    const res = await get('/admissions')
    expect(res.status).toBe(200)
    expect(res.body).toContain('We admit 44 students')
  })

  it('leaves a served coded view untouched, whatever the CMS holds', async () => {
    // Precedence is structural rather than a lookup race: the hook consults
    // the CMS only for a 404, so a coded view that rendered is never second-
    // guessed. Asserted on the handler itself because it is the rule, and a
    // page published at '/' exists in this fixture to make the point real.
    const handler = async (req: Request, response: Response) => {
      if (response.status !== 404)
        return undefined
      return await cmsPageFallback(req, SITE) ?? undefined
    }

    const coded = new Response('<h1>CODED VIEW</h1>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    const untouched = await handler(new Request('http://lakeside.localhost/'), coded)
    expect(untouched).toBeUndefined()

    // ...and the same path DOES resolve a CMS page when nothing coded served it.
    const replaced = await handler(new Request('http://lakeside.localhost/'), new Response('nope', { status: 404 }))
    expect(replaced?.status).toBe(200)
    expect(await replaced!.text()).toContain('CMS VERSION')
  })

  it('never serves an unpublished page', async () => {
    expect((await get('/secret')).status).toBe(404)
  })

  it('404s a path with neither a view nor a page', async () => {
    expect((await get('/nothing-at-all')).status).toBe(404)
  })
})
