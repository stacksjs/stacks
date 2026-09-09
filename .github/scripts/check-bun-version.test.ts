import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { EXPECTED_LOCKFILE_VERSION } from './check-lockfile-version'
import { isPinnedBun, mismatchWarning, pinnedBunVersion } from './check-bun-version'

const packageJson = readFileSync(resolve(import.meta.dir, '..', '..', 'package.json'), 'utf8')

describe('pinned Bun guard', () => {
  it('reads engines.bun', () => {
    expect(pinnedBunVersion('{"engines":{"bun":"1.4.1"}}')).toBe('1.4.1')
    expect(pinnedBunVersion('{}')).toBeNull()
    expect(pinnedBunVersion('{"engines":{}}')).toBeNull()
  })

  /**
   * "Close enough" is what produced the lockfile nobody asked for. 1.3.14
   * satisfies every range you would reasonably write around 1.4.1 - ^1.3, >=1.3,
   * 1.x - and it is the version that rewrote bun.lock. So the comparison is
   * exact, and this test is here to stop it being loosened into a range later.
   */
  it('accepts only the exact pinned version', () => {
    expect(isPinnedBun('1.4.1', '1.4.1')).toBe(true)
    expect(isPinnedBun('1.3.14', '1.4.1')).toBe(false)
    expect(isPinnedBun('1.4.2', '1.4.1')).toBe(false)
    expect(isPinnedBun('1.4.10', '1.4.1')).toBe(false)
  })

  it('stays quiet when there is nothing to compare', () => {
    expect(isPinnedBun('1.3.14', null)).toBe(true)
    expect(isPinnedBun(undefined, '1.4.1')).toBe(true)
  })

  it('names both versions and how to undo the damage', () => {
    const warning = mismatchWarning('1.3.14', '1.4.1')
    expect(warning).toContain('1.3.14')
    expect(warning).toContain('1.4.1')
    expect(warning).toContain('git checkout -- bun.lock')
    expect(warning).toContain('./pantry/.bin/bun install')
  })

  it('pins a Bun in package.json', () => {
    expect(pinnedBunVersion(packageJson)).toMatch(/^\d+\.\d+\.\d+$/)
  })

  /**
   * The two guards have to agree. `engines.bun` names the toolchain and
   * `EXPECTED_LOCKFILE_VERSION` names the format that toolchain writes; if
   * someone bumps the pin without regenerating the lockfile, the repository is
   * claiming two different things and one of the checks is lying.
   */
  it('agrees with the committed lockfile version', () => {
    const lockfile = readFileSync(resolve(import.meta.dir, '..', '..', 'bun.lock'), 'utf8')
    expect(lockfile).toContain(`"lockfileVersion": ${EXPECTED_LOCKFILE_VERSION}`)
  })
})
