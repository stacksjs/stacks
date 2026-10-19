// Local pre-flight for `buddy release`.
//
// release.yml gates publishing on the pinned checks, but only after a tag has
// been pushed, so a stale artifact there costs a re-tag. This runs the same
// checks before anything is bumped, committed or tagged.
//
// The check list is DERIVED from package.json on purpose. ci.yml and
// release.yml already each carry a copy, and a third hand-maintained list would
// reproduce the exact drift problem the gate exists to prevent.

import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { acceptedPublications, publicationMatchesOriginal } from '../../../../../.github/scripts/npm-publication'
import { BYPASS_ENV, formatPreflightFailure, pinnedCheckScripts, runPinnedChecks } from '../src/release-preflight'

describe('accepted npm publication recovery', () => {
  const bytes = new TextEncoder().encode('original accepted archive')
  const receipt = {
    name: '@stacksjs/example', version: '1.2.3',
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    shasum: createHash('sha1').update(bytes).digest('hex'),
  }
  const tarball = 'https://registry.npmjs.org/@stacksjs/example/-/example-1.2.3.tgz'
  const metadata = { name: receipt.name, version: receipt.version, dist: { tarball, integrity: receipt.integrity, shasum: receipt.shasum } }

  it('keeps the original checksums for the scoped package actually accepted', () => {
    expect(acceptedPublications([
      'Publishing @stacksjs/example...',
      `Publishing ${receipt.name}@${receipt.version}...`,
      `Shasum: ${receipt.shasum}`,
      `Integrity: ${receipt.integrity}`,
      'Error: Upload accepted; publication is pending public metadata and verified tarball availability. Do not upload this version again.',
    ].join('\n'))).toEqual([receipt])
  })

  it('refuses a pending upload whose original archive identity was not recorded', () => {
    expect(() => acceptedPublications('Publishing @stacksjs/example@1.2.3...\nError: Upload accepted; publication is pending public metadata')).toThrow('no complete original archive receipt')
  })

  it('refuses to resume when metadata is absent even if the tarball is readable', async () => {
    const requests: string[] = []
    expect(await publicationMatchesOriginal(receipt, async (url) => {
      requests.push(url)
      return url === tarball ? new Response(bytes) : new Response('', { status: 404 })
    })).toBe(false)
    expect(requests).toEqual(['https://registry.npmjs.org/%40stacksjs%2Fexample/1.2.3'])
  })

  it('requires metadata for this exact package, version and original checksum', async () => {
    for (const changed of [
      { ...metadata, name: '@stacksjs/another' },
      { ...metadata, version: '1.2.4' },
      { ...metadata, dist: { ...metadata.dist, integrity: 'sha512-different' } },
      { ...metadata, dist: { ...metadata.dist, tarball: 'https://unrelated.invalid/archive.tgz' } },
    ]) {
      expect(await publicationMatchesOriginal(receipt, async () => Response.json(changed))).toBe(false)
    }
  })

  it('rejects different archive bytes despite matching metadata', async () => {
    expect(await publicationMatchesOriginal(receipt, async url => url === tarball
      ? new Response('different archive')
      : Response.json(metadata))).toBe(false)
  })

  it('permits a resume only after read-only metadata and full original-byte verification', async () => {
    const methods: string[] = []
    expect(await publicationMatchesOriginal(receipt, async (url, init) => {
      methods.push(init.method)
      return url === tarball ? new Response(bytes) : Response.json(metadata)
    })).toBe(true)
    expect(methods).toEqual(['GET', 'GET'])
  })
})

describe('pinnedCheckScripts', () => {
  it('picks up both the bare and the segmented forms', () => {
    // `docs:check` has no middle segment; `docs:buddy:check` does. A first
    // attempt at this regex required one and silently dropped the unsegmented
    // scripts from the suite, shrinking the gate.
    expect(pinnedCheckScripts({
      'docs:check': 'x',
      'docs:artifacts:check': 'x',
      'docs:buddy:check': 'x',
    })).toEqual(['docs:artifacts:check', 'docs:buddy:check', 'docs:check'])
  })

  it('excludes checks that are not generated-artifact freshness checks', () => {
    // These also end in `:check`, but two of them have no generator to fix
    // them with, so blocking a release on them would offer no remedy.
    expect(pinnedCheckScripts({
      'types:check': 'x',
      'format:check': 'x',
      'deps:lockfile:check': 'x',
      'docs:links:check': 'x',
    })).toEqual(['docs:links:check'])
  })

  it('excludes generators, keeping only their check counterparts', () => {
    expect(pinnedCheckScripts({
      'docs:buddy': 'x',
      'docs:buddy:check': 'x',
      'docs:artifacts': 'x',
    })).toEqual(['docs:buddy:check'])
  })

  it('picks up a newly added check with no code change', () => {
    // The point of deriving the list: adding a script is enough.
    expect(pinnedCheckScripts({ 'docs:brand-new:check': 'x' })).toEqual(['docs:brand-new:check'])
  })

  it('returns a stable order regardless of key order', () => {
    const a = pinnedCheckScripts({ 'docs:b:check': 'x', 'docs:a:check': 'x' })
    const b = pinnedCheckScripts({ 'docs:a:check': 'x', 'docs:b:check': 'x' })
    expect(a).toEqual(b)
  })

  it('tolerates a package.json with no scripts', () => {
    expect(pinnedCheckScripts({})).toEqual([])
  })
})

describe('runPinnedChecks', () => {
  it('skips everything when the bypass is set', async () => {
    // Without an escape hatch, one chronically red unrelated check would brick
    // releasing entirely, which is worse than the problem being solved.
    for (const value of ['1', 'true']) {
      const result = await runPinnedChecks({ cwd: process.cwd(), env: { [BYPASS_ENV]: value } })
      expect(result.bypassed).toBe(true)
      expect(result.ran).toEqual([])
    }
  })

  it('does not treat an unrelated value as a bypass', async () => {
    // Fail closed: only an explicit 1/true counts, so a stray empty or "false"
    // cannot quietly disable the gate.
    const result = await runPinnedChecks({ cwd: process.cwd(), env: { [BYPASS_ENV]: 'false' }, scripts: [] })
    expect(result.bypassed).toBe(false)
  })

  it('reports a failing script with its output', async () => {
    // `--version` exists; the bogus one does not, so bun run exits non-zero.
    const result = await runPinnedChecks({
      cwd: process.cwd(),
      env: {},
      scripts: ['definitely-not-a-real-script-xyz'],
    })

    expect(result.bypassed).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]!.script).toBe('definitely-not-a-real-script-xyz')
  })

  it('runs every script even after one fails', async () => {
    // A release blocked by two stale artifacts should cost one round trip, not
    // two, so the runner must not stop at the first failure.
    const result = await runPinnedChecks({
      cwd: process.cwd(),
      env: {},
      scripts: ['definitely-not-a-real-script-a', 'definitely-not-a-real-script-b'],
    })

    expect(result.ran).toHaveLength(2)
    expect(result.failures).toHaveLength(2)
  })
})

describe('formatPreflightFailure', () => {
  it('shows the stale artifact after multiline environment decryption warnings', () => {
    const message = formatPreflightFailure([{
      script: 'docs:native-skills:check',
      output: [
        '[env-plugin] Errors: [',
        ...Array.from({ length: 42 }, (_, index) => `  "Failed to decrypt VALUE_${index}: Environment decryption failed"`),
        ']',
        '[env] warning: skipped encrypted values; defaults apply',
        'Native skill references are stale: storage/framework/defaults/ai/skills/stacks-native/CATALOG.md. Run ./buddy docs:native-skills.',
      ].join('\n'),
    }])

    expect(message).toContain('stacks-native/CATALOG.md')
    expect(message).toContain('Run ./buddy docs:native-skills.')
    expect(message).not.toContain('[env-plugin]')
    expect(message).not.toContain('Failed to decrypt')
  })

  it('quotes the informative lines and strips wrapper noise', () => {
    const message = formatPreflightFailure([{
      script: 'docs:artifacts:check',
      output: [
        '[env] loaded 32/45 variables from .env',
        '$ ./buddy docs:artifacts:check',
        'storage/framework/api/openapi.json is stale',
        'Run bun run docs:artifacts and review the generated diff.',
        'error: script "docs:artifacts:check" exited with code 1',
      ].join('\n'),
    }])

    expect(message).toContain('storage/framework/api/openapi.json is stale')
    expect(message).toContain('Run bun run docs:artifacts')
    // The wrapper noise crowds out the two lines that say what is wrong.
    expect(message).not.toContain('[env]')
    expect(message).not.toContain('$ ./buddy')
    expect(message).not.toContain('error: script')
  })

  it('preserves environment diagnostics when no check diagnostic follows', () => {
    const message = formatPreflightFailure([{
      script: 'docs:links:check',
      output: '[env-plugin] Errors: [\n  "Required environment value could not be decrypted"\n]',
    }])

    expect(message).toContain('Required environment value could not be decrypted')
  })

  it('states that nothing was mutated, and how to proceed', () => {
    const message = formatPreflightFailure([{ script: 'docs:links:check', output: 'boom' }])

    // The whole value over the CI gate is that this runs before the tag exists.
    expect(message).toContain('Nothing was bumped, committed, or tagged.')
    expect(message).toContain(BYPASS_ENV)
  })

  it('pluralises honestly', () => {
    expect(formatPreflightFailure([{ script: 'a', output: '' }])).toContain('1 pinned check failed')
    expect(formatPreflightFailure([
      { script: 'a', output: '' },
      { script: 'b', output: '' },
    ])).toContain('2 pinned checks failed')
  })
})
