import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, getLocale, setLocale, t } from '../src/translator'

describe('ensureLocalesLoaded', () => {
  const tmpDir = join(import.meta.dir, '.tmp-locales')

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }) }
    catch { /* ignore */ }
  })

  it('loads locale YAML files from a locales directory', async () => {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, 'de.yml'), 'greeting: Hallo\n')
    writeFileSync(join(tmpDir, 'en.yml'), 'greeting: Hello\n')

    const { loadFromDirectory } = await import('../src/loader')
    await loadFromDirectory({ directory: tmpDir, extensions: ['.yml'] })
    configure({ locale: 'de', fallbackLocale: 'en' })
    setLocale('de')
    expect(t('greeting')).toBe('Hallo')
    setLocale('en')
    expect(t('greeting')).toBe('Hello')
  })

  it('resolveRequestLocale prefers query param', async () => {
    const { resolveRequestLocale } = await import('../src/bootstrap')
    configure({ locale: 'de', fallbackLocale: 'en', availableLocales: ['de', 'en'] })
    const req = new Request('http://local/search?locale=en')
    expect(resolveRequestLocale(req)).toBe('en')
    expect(getLocale()).toBe('de')
  })
})
