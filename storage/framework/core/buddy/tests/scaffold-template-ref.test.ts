/**
 * Which point in history `buddy new` scaffolds from.
 *
 * It used to be the default branch, unconditionally, while the unvendor step
 * pinned the framework to the newest PUBLISHED version. Those are two different
 * commits whenever a release has not happened yet, and the gap between them is
 * userland written against framework changes the app cannot install. A freshly
 * scaffolded app then failed its own `./buddy typecheck` before the user had
 * touched anything.
 *
 * It has happened at least twice: `MobileConfig` in stacksjs/stacks#2322, and
 * `security.api` (from #2375) six commits after v0.73.3, which is what this was
 * measured against - the repository's own `config/` did not typecheck against
 * the framework a `buddy new` app would have installed that day.
 *
 * Scaffolding from the tag that matches the pinned version closes the gap by
 * construction. These tests pin the resolution and its fallbacks; what they
 * cannot cover is the download itself, which needs the network.
 */

import { describe, expect, it } from 'bun:test'
import { templateRef, templateSpec } from '../src/commands/create'

describe('templateRef', () => {
  it('scaffolds from the tag matching the newest published release', async () => {
    const ref = await templateRef(async () => ({ latest: '0.73.3', versions: new Set(['0.73.2', '0.73.3']) }))

    // The `v` prefix is the repository's tag naming, and the whole point is
    // that this names the SAME release the app is about to pin.
    expect(ref).toBe('v0.73.3')
  })

  it('falls back to the default branch when the registry cannot be reached', async () => {
    const ref = await templateRef(async () => { throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org') })

    // Offline is not a reason to refuse to scaffold. This is what shipped
    // before the tag pin, so the fallback is the old behaviour rather than a
    // degraded one.
    expect(ref).toBeNull()
  })

  it('falls back to the default branch when the package has no release', async () => {
    // No `latest` dist-tag means no release, and so no tag to scaffold from.
    const ref = await templateRef(async () => ({ latest: undefined, versions: new Set<string>() }))

    expect(ref).toBeNull()
  })
})

describe('templateSpec', () => {
  it('asks gitit for the tag when there is one', () => {
    // gitit parses the ref off a `#` suffix, and its accepted charset covers a
    // dotted version tag. Pinned here because the whole fix is this suffix.
    expect(templateSpec('v0.73.3')).toBe('gh:stacksjs/stacks#v0.73.3')
  })

  it('asks for the default branch when there is not', () => {
    expect(templateSpec(null)).toBe('gh:stacksjs/stacks')
  })

  it('keeps resolving the GitHub provider directly', () => {
    // `gh:` is deliberate: the bare `stacks` name goes through gitit's template
    // registry, which still points at the old org and only reaches us via a
    // repo-transfer redirect. Adding a ref must not quietly drop the prefix.
    for (const spec of [templateSpec(null), templateSpec('v1.2.3')])
      expect(spec.startsWith('gh:stacksjs/stacks')).toBe(true)
  })
})
