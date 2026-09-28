/**
 * An app view overrides the framework default at the same path, dynamic
 * routes included.
 *
 * Both view servers hand stx `resolveViewPatterns()`: the app's
 * `resources/views` first, the framework defaults after, and stx is meant to
 * take the first root that has the page. For a static page it did. For a
 * dynamic one it did not: hq.training's `resources/views/password/reset/[token].stx`
 * was listed in the generated route manifest for `/password/reset/:token` and
 * `./buddy dev` still rendered the default, because stx ranked dynamic pages
 * by the specificity of the whole file path, and the defaults root sits
 * several directories deeper than `resources/views`. Fixed in stx 0.2.319
 * (stacksjs/stx@8c60cb8).
 *
 * This runs the pieces the way the view servers do - the real defaults tree,
 * the patterns and exclusions from `resolveViewPatterns` with every bundle
 * mounted (so the default reset page is live and has to lose), the installed
 * stx `serve` - against an app that overrides one static and one dynamic
 * default page. `BUN_PLUGIN_STX_SRC` points it at another copy of stx, as it
 * does the production server.
 */

import { afterAll, beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { resolveViewPatterns } from '@stacksjs/config'
import { mountedDefaultRouteBundles } from '@stacksjs/router'
import { resolveDefaultsResources } from '../src/dev/defaults-resources'

setDefaultTimeout(60_000)

// Absolute, so the driver below loads the same copy from a temporary directory.
const SERVE = process.env.BUN_PLUGIN_STX_SRC || Bun.resolveSync('bun-plugin-stx/serve', import.meta.dir)

const PORT = 44_600 + (process.pid % 700)
const BASE = `http://localhost:${PORT}`

let dir: string
let proc: ReturnType<typeof Bun.spawn> | null = null

describe('app views override framework defaults', () => {
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'stacks-view-override-'))
    await Bun.write(join(dir, 'resources/views/password/reset/[token].stx'), '<p>APP-RESET-PAGE</p>\n')
    await Bun.write(join(dir, 'resources/views/forgot-password.stx'), '<p>APP-FORGOT-PAGE</p>\n')

    // No discovered packages: only the app root and the framework defaults,
    // with every default bundle mounted.
    const { patterns, exclude } = resolveViewPatterns(
      'resources/views',
      join(resolveDefaultsResources(), 'views'),
      undefined,
      undefined,
      [],
      mountedDefaultRouteBundles(() => true, {}),
    )

    await Bun.write(join(dir, 'driver.ts'), `import { serve } from ${JSON.stringify(SERVE)}

serve({ patterns: ${JSON.stringify(patterns)}, exclude: ${JSON.stringify(exclude)}, port: ${PORT}, quiet: true })
`)

    proc = Bun.spawn(['bun', join(dir, 'driver.ts')], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })

    for (let i = 0; i < 150; i++) {
      try {
        await fetch(`${BASE}/forgot-password`)
        break
      }
      catch {
        await Bun.sleep(100)
      }
    }
  })

  afterAll(async () => {
    proc?.kill()
    await rm(dir, { recursive: true, force: true })
  })

  it('serves the app page at a static path the defaults also define', async () => {
    expect(await (await fetch(`${BASE}/forgot-password`)).text()).toContain('APP-FORGOT-PAGE')
  })

  it('serves the app page at a dynamic path the defaults also define', async () => {
    const res = await fetch(`${BASE}/password/reset/abc123?email=a%40b.c`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('APP-RESET-PAGE')
  })
})
