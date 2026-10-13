import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { craftBuilderSpecifier, craftBuilderVersion } from '../src/build/craft-entry'

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

describe('the version of the Craft an app is generated with', () => {
  it('is read from the copy @stacksjs/mobile resolves', () => {
    const app = mkdtempSync(join(tmpdir(), 'craft-version-'))
    try {
      const hoisted = craft('0.0.164')
      pkg(join(app, 'node_modules/craft-native'), hoisted.manifest, hoisted.files)
      pkg(join(app, 'node_modules/@stacksjs/mobile'), { name: '@stacksjs/mobile', version: '1.0.0' })
      const nested = craft('0.0.162')
      pkg(join(app, 'node_modules/@stacksjs/mobile/node_modules/craft-native'), nested.manifest, nested.files)

      const found = craftBuilderVersion(craftBuilderSpecifier('ios', app), app)
      expect(found?.version).toBe('0.0.162')
      expect(found?.manifest).toContain('/@stacksjs/mobile/node_modules/craft-native/package.json')
    }
    finally {
      rmSync(app, { recursive: true, force: true })
    }
  })

  it('walks up from a Craft checkout\'s builder source to its package', () => {
    const checkout = mkdtempSync(join(tmpdir(), 'craft-checkout-'))
    try {
      pkg(join(checkout, 'packages/ios'), { name: '@craft-native/ios', version: '0.0.165' })
      mkdirSync(join(checkout, 'packages/ios/src'), { recursive: true })
      writeFileSync(join(checkout, 'packages/ios/src/index.ts'), 'export {}')

      expect(craftBuilderVersion(join(checkout, 'packages/ios/src/index.ts'), checkout)?.version).toBe('0.0.165')
    }
    finally {
      rmSync(checkout, { recursive: true, force: true })
    }
  })

  it('is unknown when no Craft package encloses the entry', () => {
    const bare = mkdtempSync(join(tmpdir(), 'craft-version-bare-'))
    try {
      expect(craftBuilderVersion('craft-native/ios', bare)).toBeUndefined()
    }
    finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })
})
