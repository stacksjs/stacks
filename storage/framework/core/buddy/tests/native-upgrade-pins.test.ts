import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { raiseExactFrameworkPins } from '../src/native-project'

let root: string

/** A registry with the given releases, `latest` at the newest unless named. */
function registry(releases: Record<string, string[]>, latest: Record<string, string> = {}): typeof fetch {
  return (async (url: string | URL | Request) => {
    const name = decodeURIComponent(String(url).replace('https://registry.npmjs.org/', ''))
    const versions = releases[name]
    if (!versions)
      return new Response('', { status: 404 })
    return Response.json({ 'dist-tags': { latest: latest[name] ?? versions.at(-1) }, 'versions': Object.fromEntries(versions.map(version => [version, {}])) })
  }) as typeof fetch
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-native-upgrade-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('a native app\'s exact framework pins on upgrade', () => {
  it('move to the newest release in their own line, and stay exact', async () => {
    // launchpad, as scaffolded: `bun update` left the exact pin on 0.75.520.
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({
      stacks: { type: 'native' },
      dependencies: { '@stacksjs/stx': '0.2.900' },
      devDependencies: { '@stacksjs/buddy': '0.75.520', 'better-dx': '0.2.38' },
      overrides: { '@stacksjs/stx': '0.2.900' },
    }, null, 2)}\n`)
    const read = registry({
      '@stacksjs/buddy': ['0.75.520', '0.75.629', '0.76.0'],
      '@stacksjs/stx': ['0.2.900', '0.2.913', '0.2.914-beta.1', '0.3.0'],
    }, { '@stacksjs/buddy': '0.75.629', '@stacksjs/stx': '0.2.913' })

    expect(await raiseExactFrameworkPins(root, { read })).toEqual([
      { name: '@stacksjs/stx', from: '0.2.900', to: '0.2.913' },
      { name: '@stacksjs/buddy', from: '0.75.520', to: '0.75.629' },
    ])
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(manifest.devDependencies).toEqual({ '@stacksjs/buddy': '0.75.629', 'better-dx': '0.2.38' })
    expect(manifest.dependencies['@stacksjs/stx']).toBe('0.2.913')
    expect(manifest.overrides['@stacksjs/stx']).toBe('0.2.913')
  })

  it('leaves ranges, other packages and a dry run alone', async () => {
    const original = `${JSON.stringify({ dependencies: { '@stacksjs/stx': '^0.2.900', 'zod': '3.0.0', '@stacksjs/buddy': '0.75.520' } }, null, 2)}\n`
    writeFileSync(join(root, 'package.json'), original)
    const read = registry({ '@stacksjs/buddy': ['0.75.520', '0.75.629'] })

    expect(await raiseExactFrameworkPins(root, { read, dryRun: true })).toEqual([{ name: '@stacksjs/buddy', from: '0.75.520', to: '0.75.629' }])
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(original)
  })
})
