import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'

const components = resolve('storage/framework/defaults/resources/components')

describe('native component theme contract', () => {
  it('keeps the tab bar aligned with the app theme instead of the OS preference', () => {
    const source = readFileSync(resolve(components, 'NativeTabBar.stx'), 'utf8')

    expect(source).toContain('.dark .native-tab-bar')
    expect(source).toContain('.dark .native-tab-item')
    expect(source).not.toContain('prefers-color-scheme')
  })
})
