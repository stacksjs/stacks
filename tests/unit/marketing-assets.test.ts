/**
 * Versioned stylesheet URLs, and the templates that must use them.
 *
 * public/ is served with a one-hour max-age. A stylesheet linked by bare path
 * keeps its old copy in a returning visitor's cache after a deploy, so new
 * markup renders against old CSS - which is how the rebuilt home page showed
 * its Laravel call-out as unstyled text in production. assetUrl() versions the
 * URL by content; these tests pin that, and pin that the marketing templates
 * actually go through it, since a bare href regresses silently.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { assetUrl } from '../../resources/data/assets'

const root = join(import.meta.dir, '../..')

describe('assetUrl', () => {
  test('versions a stylesheet by its content hash', () => {
    const path = '/assets/styles/home.css'
    const hash = Bun.hash(readFileSync(join(root, 'public', path))).toString(36)

    expect(assetUrl(path)).toBe(`${path}?v=${hash}`)
  })

  test('still versions a path it cannot read, so a cache is busted anyway', () => {
    expect(assetUrl('/assets/styles/does-not-exist.css')).toMatch(/^\/assets\/styles\/does-not-exist\.css\?v=[0-9a-z]+$/)
  })
})

describe('the marketing templates', () => {
  const templates = [
    'resources/partials/marketing-head.stx',
    'resources/views/index.stx',
    'resources/views/coming-soon.stx',
  ]

  for (const file of templates) {
    test(`${file} links no stylesheet by a bare, unversioned path`, () => {
      const source = readFileSync(join(root, file), 'utf8')
      expect(source).not.toMatch(/<link rel="stylesheet" href="\/assets\//)
    })
  }
})
