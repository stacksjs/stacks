import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { resolveFile } from '../../../../../.github/lighthouse/serve'

/**
 * The static server behind the Lighthouse audit (stacksjs/stacks#1222).
 *
 * Two of these are the reason it is a committed script rather than a `bunx
 * serve` one-liner: traversal and the missing-page answer are both decisions,
 * and both are wrong by default in the obvious implementations.
 */

const root = mkdtempSync(join(tmpdir(), 'stacks-lh-'))

function page(relative: string): void {
  const full = join(root, relative)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, '<html></html>')
}

page('index.html')
page('guide/intro/index.html')
page('assets/app.css')

afterAll(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('resolveFile', () => {
  it('serves the index for the root', () => {
    expect(resolveFile(root, '/')).toBe(join(root, 'index.html'))
  })

  it('serves an extensionless route from its index, which is how bunpress addresses pages', () => {
    expect(resolveFile(root, '/guide/intro')).toBe(join(root, 'guide/intro/index.html'))
  })

  it('serves a real file directly', () => {
    expect(resolveFile(root, '/assets/app.css')).toBe(join(root, 'assets/app.css'))
  })

  it('returns null for a missing page rather than falling back to the index', () => {
    // An SPA fallback would make Lighthouse score the home page for a URL that
    // does not exist, and report a healthy site with a broken link in it.
    expect(resolveFile(root, '/does-not-exist')).toBeNull()
    expect(resolveFile(root, '/guide/nope')).toBeNull()
  })

  it('refuses to escape the build directory', () => {
    // This serves a build directory on a CI runner; a traversal reads the
    // checkout.
    for (const pathname of ['/../../../etc/passwd', '/../package.json', '/..%2F..%2Fpackage.json'])
      expect(resolveFile(root, pathname)).toBeNull()
  })

  it('decodes percent-encoding before resolving', () => {
    expect(resolveFile(root, '/guide%2Fintro')).toBe(join(root, 'guide/intro/index.html'))
  })
})
