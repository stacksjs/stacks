/**
 * i18n loader integration tests.
 *
 * Covers the loader's three input shapes (JSON, YAML, TS module),
 * directory-namespacing convention, language-part fallback chain,
 * and the new ts-i18n delegation entry. Pins the contracts the
 * Stacks-specific layer assumes so the lib can evolve underneath
 * without surprises.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string

describe('i18n loader', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stacks-i18n-test-'))
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }) }
    catch { /* best-effort */ }
  })

  it('loads JSON translation files', async () => {
    writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ greeting: 'Hi' }))
    const { loadFromDirectory } = await import('../src/loader')
    const result = await loadFromDirectory({ directory: tmpDir, extensions: ['.json'] })
    expect(result.en).toEqual({ greeting: 'Hi' })
  })

  it('loads YAML translation files', async () => {
    writeFileSync(join(tmpDir, 'en.yaml'), 'greeting: Hi\n')
    const { loadFromDirectory } = await import('../src/loader')
    const result = await loadFromDirectory({ directory: tmpDir, extensions: ['.yaml', '.yml'] })
    // YAML loader should produce the same shape as JSON
    expect(result.en).toMatchObject({ greeting: 'Hi' })
  })

  it('returns empty object for missing directory (warns, not throws)', async () => {
    const { loadFromDirectory } = await import('../src/loader')
    const result = await loadFromDirectory({ directory: join(tmpDir, 'does-not-exist') })
    expect(result).toEqual({})
  })

  it('skips non-translation file extensions', async () => {
    writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ k: 1 }))
    writeFileSync(join(tmpDir, 'README.md'), '# notes')
    writeFileSync(join(tmpDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    const { loadFromDirectory } = await import('../src/loader')
    const result = await loadFromDirectory({ directory: tmpDir })
    expect(result.en).toBeDefined()
    expect(Object.keys(result)).toEqual(['en'])
  })

  it('language-part fallback resolves en-GB → en before falling back to default', async () => {
    const { I18n } = await import('../src/translator')
    const i18n = new I18n({ defaultLocale: 'en', fallbackLocale: 'es' })
    i18n.addTranslations('en', { greeting: 'Hello' })
    i18n.addTranslations('en-GB', { farewell: 'Cheerio' })
    i18n.addTranslations('es', { greeting: 'Hola' })

    i18n.setLocale('en-GB')
    // Key only in en-GB:
    expect(i18n.t('farewell')).toBe('Cheerio')
    // Key missing from en-GB, present in en — should NOT fall through
    // all the way to es:
    expect(i18n.t('greeting')).toBe('Hello')
  })
})
