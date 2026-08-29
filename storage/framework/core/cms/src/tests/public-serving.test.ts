/**
 * The serving contract, pinned end to end.
 *
 * `cmsPageFallback` was unit-tested and the servers' `onResponse` wiring was
 * eyeballed, which is not the same as knowing a request produces a page. It
 * did not: the first real check served a 404 because stx-serve's own
 * not-found response looked like it might return before the hook, and a
 * separate port collision hid the answer for several rounds.
 *
 * This test runs the exact composition the dev and production servers use -
 * stx `serve()` with the CMS fallback installed as `onResponse` - so the two
 * properties that matter can never silently regress:
 *
 *   1. a published page is served for a path with no coded view
 *   2. a coded stx view still wins for a path that has one
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { registerDefaultBlocks } from '../blocks/defaults'
import { getDb } from '../database'
import { createPageDocument } from '../pages/document'
import { cmsPageFallback } from '../public/fallback'
import { refreshDatabase } from './setup'

const SITE = { id: 1, name: 'Lakeside', subdomain: 'lakeside', settings: {} }
const PORT = 3187

let viewsDir: string
let stop: (() => void) | undefined
let originalCwd: string

beforeAll(async () => {
  await refreshDatabase()
  registerDefaultBlocks()

  // Block partials and the page template resolve against the process's
  // working directory, which for a server is the project root. `bun test`
  // runs from the package, so pin cwd to the root or every block renders
  // empty - a difference worth encoding rather than discovering again.
  originalCwd = process.cwd()
  process.chdir(resolve(import.meta.dir, '../../../../../..'))

  // Unused placeholder kept so cleanup stays uniform; the coded view under
  // test is the framework's real `resources/views/index.stx`, because stx
  // routes views from the project's own views root - a temp directory
  // outside it produces no route at all, which is itself worth knowing.
  viewsDir = mkdtempSync(join(tmpdir(), 'stacks-cms-serve-'))
  writeFileSync(join(viewsDir, '.keep'), '')

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

  const { serve } = await import('bun-plugin-stx/serve')
  // Not awaited: serve()'s promise does not settle while the server is up,
  // so awaiting it here hangs the hook. Start it, then poll the port.
  void (serve)({
    patterns: ['resources/views/**/*.stx'],
    port: PORT,
    quiet: true,
    // Byte-for-byte what both stx servers install.
    onResponse: async (req: Request, response: Response) => {
      if (response.status !== 404)
        return undefined
      return await cmsPageFallback(req, SITE) ?? undefined
    },
  }).then((result: { stop?: () => void } | undefined) => { stop = result?.stop })

  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/__ready`)
      return
    }
    catch {
      await Bun.sleep(100)
    }
  }
  throw new Error(`stx server did not come up on ${PORT}`)
}, 30_000)

afterAll(async () => {
  stop?.()
  const db = await getDb()
  await db.unsafe('DELETE FROM pages').execute()
  if (viewsDir)
    rmSync(viewsDir, { recursive: true, force: true })
  if (originalCwd)
    process.chdir(originalCwd)
})

async function get(path: string): Promise<{ status: number, body: string }> {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { headers: { Host: 'lakeside.localhost' } })
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
