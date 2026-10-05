import { describe, expect, it } from 'bun:test'
import { Glob } from 'bun'
import { DEFAULT_ANTHROPIC_MODEL } from '../src/models'

/**
 * Seven call sites each spelled `claude-sonnet-4-20250514` inline. Two problems
 * in one string: the generation was two behind, and current Anthropic model ids
 * carry no date suffix, so the shape was wrong as well as the version.
 *
 * Nothing coordinated the seven, which is the part worth preventing. These
 * assertions are structural because a stale-but-still-served model id produces
 * no error - it just quietly runs an older model than the caller expects.
 */
const SRC = new URL('../src/', import.meta.url).pathname

describe('default Anthropic model', () => {
  it('carries no date suffix', () => {
    // A current id is `claude-sonnet-5-5`, never `claude-sonnet-4-20250514`.
    expect(DEFAULT_ANTHROPIC_MODEL).not.toMatch(/-\d{8}$/)
    expect(DEFAULT_ANTHROPIC_MODEL).toMatch(/^claude-[a-z]+-\d+(-\d+)?$/)
  })

  it('is the only place the package names a Claude model', async () => {
    const offenders: string[] = []

    for (const relative of new Glob('**/*.ts').scanSync({ cwd: SRC })) {
      if (relative === 'models.ts')
        continue

      const source = await Bun.file(`${SRC}${relative}`).text()
      // Matches quoted ids anywhere, comments included - deliberately. A
      // commented example is a second copy that goes stale silently, so prose
      // here points at the constant instead of quoting a version.
      // A model id ends in a version number; this package's own driver and
      // transport names (claude-sdk, claude-cli-local, claude-agent-sdk) do
      // not, so the shape separates them without an allowlist to maintain.
      // The `anthropic.`-prefixed Bedrock ids are a different surface and do
      // not match either.
      for (const match of source.matchAll(/['"`](claude-[a-z]+-\d[\w.-]*)['"`]/g))
        offenders.push(`${relative}: ${match[1]}`)
    }

    expect(offenders).toEqual([])
  })
})
