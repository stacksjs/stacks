import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { path } from '@stacksjs/path'
import { autoImportSourceFingerprint, autoImportsAreStale } from '../src/imports'

/**
 * Staleness a fresh checkout can see (stacksjs/stacks#2947).
 *
 * File times say nothing on a fresh clone or a CI run, where every file has
 * the checkout's time, so a committed registry generated before an app added
 * its own `LoginAction` looked current and named the framework's. The recorded
 * source listing does not depend on times.
 */
const sources = path.storagePath('framework/auto-imports/sources.json')
const manifest = path.storagePath('framework/auto-imports/functions.ts')
const original = existsSync(sources) ? readFileSync(sources, 'utf8') : undefined

afterAll(() => {
  if (original !== undefined)
    writeFileSync(sources, original)
})

/** Every source older than the manifest, as on a fresh checkout. */
function timesSayFresh(): void {
  const now = new Date()
  utimesSync(manifest, now, new Date(now.getTime() + 60_000))
}

describe('autoImportsAreStale', () => {
  it('is false when the recorded listing matches the tree', () => {
    writeFileSync(sources, `${JSON.stringify({ fingerprint: autoImportSourceFingerprint() }, null, 2)}\n`)
    timesSayFresh()
    expect(autoImportsAreStale()).toBe(false)
  })

  it('is true when the tree has files the registry was not generated from, whatever the times say', () => {
    writeFileSync(sources, `${JSON.stringify({ fingerprint: 'generated-before-app-LoginAction-existed' }, null, 2)}\n`)
    timesSayFresh()
    expect(autoImportsAreStale()).toBe(true)
  })

  it('is true when nothing was recorded, so an older registry regenerates once', () => {
    writeFileSync(sources, '{}\n')
    timesSayFresh()
    expect(autoImportsAreStale()).toBe(true)
  })

  it('fingerprints the same tree the same way every time', () => {
    expect(autoImportSourceFingerprint()).toBe(autoImportSourceFingerprint())
    expect(autoImportSourceFingerprint()).toMatch(/^[0-9a-f]{64}$/)
  })
})
