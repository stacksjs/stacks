import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { craftBuilderSpecifier } from '../src/build/craft-entry'

const root = mkdtempSync(join(tmpdir(), 'craft-entry-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function pkg(dir: string, manifest: Record<string, unknown>, files: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
}

const craft = (version: string) => ({
  manifest: { name: 'craft-native', version, exports: { './ios': './ios.js', './android': './android.js' } },
  files: { 'ios.js': `export const version = '${version}'`, 'android.js': `export const version = '${version}'` },
})

describe('the Craft builder an app is generated with', () => {
  it('is the copy @stacksjs/mobile uses, not an older one hoisted to the root', () => {
    // The layout two different version floors left behind.
    const old = craft('0.0.104')
    pkg(join(root, 'node_modules/craft-native'), old.manifest, old.files)
    pkg(join(root, 'node_modules/@stacksjs/mobile'), { name: '@stacksjs/mobile', version: '1.0.0' })
    const current = craft('0.0.116')
    pkg(join(root, 'node_modules/@stacksjs/mobile/node_modules/craft-native'), current.manifest, current.files)

    expect(craftBuilderSpecifier('ios', root)).toContain('/@stacksjs/mobile/node_modules/craft-native/ios.js')
    expect(craftBuilderSpecifier('android', root)).toContain('/@stacksjs/mobile/node_modules/craft-native/android.js')
  })

  it('falls back to the bare package without @stacksjs/mobile', () => {
    const bare = mkdtempSync(join(tmpdir(), 'craft-entry-bare-'))
    try {
      expect(craftBuilderSpecifier('ios', bare)).toBe('craft-native/ios')
    }
    finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })
})
