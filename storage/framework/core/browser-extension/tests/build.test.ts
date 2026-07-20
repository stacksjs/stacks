import type { ExtensionConfig } from '../src/types'
import { mkdir, rm } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { buildExtension } from '../src/build'

describe('browser extension page resources', () => {
  const dirs: string[] = []

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('resolves includes from resources/partials by default', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'browser-extension-partials-'))
    dirs.push(cwd)
    await mkdir(join(cwd, 'resources/views'), { recursive: true })
    await mkdir(join(cwd, 'resources/partials'), { recursive: true })
    await Bun.write(join(cwd, 'resources/views/popup.stx'), '<main>@include(\'message\')</main>')
    await Bun.write(join(cwd, 'resources/partials/message.stx'), '<p>Built from resources/partials</p>')

    const config: ExtensionConfig = {
      name: 'Partials Test',
      description: 'Verifies the Stacks resource layout.',
      pages: { popup: 'resources/views/popup.stx' },
    }
    const { outdir } = await buildExtension(config, { cwd, target: 'chrome', version: '1.0.0', minify: false })

    expect(await Bun.file(join(outdir, 'popup.html')).text()).toContain('<p>Built from resources/partials</p>')
  })
})
