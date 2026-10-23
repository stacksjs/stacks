import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { EXPECTED_LOCKFILE_VERSION } from './check-lockfile-version'
import { isPinnedBun, mismatchWarning, pinnedBunVersion } from './check-bun-version'

const packageJson = readFileSync(resolve(import.meta.dir, '..', '..', 'package.json'), 'utf8')
const repositoryRoot = resolve(import.meta.dir, '..', '..')

describe('pinned Bun guard', () => {
  it('reads engines.bun', () => {
    expect(pinnedBunVersion('{"engines":{"bun":"1.4.4"}}')).toBe('1.4.4')
    expect(pinnedBunVersion('{}')).toBeNull()
    expect(pinnedBunVersion('{"engines":{}}')).toBeNull()
  })

  /**
   * "Close enough" is what produced the lockfile nobody asked for. 1.3.14
   * satisfies every range you would reasonably write around 1.4.4 - ^1.3, >=1.3,
   * 1.x - and it is the version that rewrote bun.lock. So the comparison is
   * exact, and this test is here to stop it being loosened into a range later.
   */
  it('accepts only the exact pinned version', () => {
    expect(isPinnedBun('1.4.4', '1.4.4')).toBe(true)
    expect(isPinnedBun('1.3.14', '1.4.4')).toBe(false)
    expect(isPinnedBun('1.4.1', '1.4.4')).toBe(false)
    expect(isPinnedBun('1.4.10', '1.4.4')).toBe(false)
  })

  it('stays quiet when there is nothing to compare', () => {
    expect(isPinnedBun('1.3.14', null)).toBe(true)
    expect(isPinnedBun(undefined, '1.4.4')).toBe(true)
  })

  it('names both versions and how to undo the damage', () => {
    const warning = mismatchWarning('1.3.14', '1.4.4')
    expect(warning).toContain('1.3.14')
    expect(warning).toContain('1.4.4')
    expect(warning).toContain('git checkout -- bun.lock')
    expect(warning).toContain('./pantry/.bin/bun install')
  })

  it('pins a Bun in package.json', () => {
    expect(pinnedBunVersion(packageJson)).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('keeps every active Bun version source aligned', () => {
    const pinnedVersion = pinnedBunVersion(packageJson)
    const deps = readFileSync(resolve(repositoryRoot, 'deps.yml'), 'utf8')
    const config = readFileSync(resolve(repositoryRoot, 'config/deps.ts'), 'utf8')
    const ci = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8')
    const memoryBenchmark = readFileSync(resolve(repositoryRoot, '.github/workflows/memory-benchmark.yml'), 'utf8')
    const routingBenchmark = readFileSync(resolve(repositoryRoot, '.github/workflows/routing-benchmark.yml'), 'utf8')
    const cloudDockerfile = readFileSync(resolve(repositoryRoot, 'cloud/Dockerfile'), 'utf8')
    const serverDockerfile = readFileSync(resolve(repositoryRoot, 'storage/framework/server/Dockerfile'), 'utf8')
    const pantryLock = JSON.parse(readFileSync(resolve(repositoryRoot, 'pantry.lock'), 'utf8')) as {
      packages: Record<string, { version: string }>
      workspaces: { '': { system: Record<string, string> } }
    }

    expect(deps.match(/^\s*bun:\s*(\S+)$/m)?.[1]).toBe(pinnedVersion)
    expect(config.match(/^\s*bun:\s*'([^']+)'/m)?.[1]).toBe(pinnedVersion)
    expect(ci.match(/^\s*BUN_VERSION:\s*'([^']+)'/m)?.[1]).toBe(pinnedVersion)
    expect(memoryBenchmark.match(/^\s*BUN_VERSION:\s*'([^']+)'/m)?.[1]).toBe(pinnedVersion)
    expect(routingBenchmark.match(/^\s*BUN_VERSION:\s*'([^']+)'/m)?.[1]).toBe(pinnedVersion)
    expect(cloudDockerfile.match(/^ARG BUN_VERSION=(\S+)$/m)?.[1]).toBe(pinnedVersion)
    expect(serverDockerfile.match(/^ARG BUN_VERSION=(\S+)$/m)?.[1]).toBe(pinnedVersion)
    expect(pantryLock.workspaces[''].system['bun.sh']).toBe(pinnedVersion)
    expect(pantryLock.packages[`bun.sh@${pinnedVersion}`]?.version).toBe(pinnedVersion)
  })

  /**
   * The list above names the files that existed when it was written, and the
   * 1.4.2 bump still left eight workflows (their `BUN_VERSION`, `bun-version`
   * or Pantry `bun.com@` pins), the framework Dockerfile and the marketing copy
   * of config/deps.ts behind. Every workflow is read here, so a new one cannot
   * pin its own Bun without this failing.
   */
  it('pins no other Bun anywhere it is written down', () => {
    const pinnedVersion = pinnedBunVersion(packageJson)
    const workflows = resolve(repositoryRoot, '.github/workflows')
    const pins: Array<[string, string]> = []

    for (const name of readdirSync(workflows).filter(file => /\.ya?ml$/.test(file))) {
      const source = readFileSync(resolve(workflows, name), 'utf8')
      for (const match of source.matchAll(/^\s*(?:BUN_VERSION|bun-version):\s*'([^'$]+)'/gm))
        pins.push([name, match[1]!])
      // Pantry package lists: `bun.com@X`, `bun.sh@X`, `bun@X`.
      for (const match of source.matchAll(/(?:^|[\s'"])bun(?:\.sh|\.com)?@(\d+\.\d+\.\d+)/gm))
        pins.push([name, match[1]!])
    }

    const frameworkDockerfile = readFileSync(resolve(repositoryRoot, 'storage/framework/Dockerfile'), 'utf8')
    pins.push(['storage/framework/Dockerfile', frameworkDockerfile.match(/^ARG BUN_VERSION=(\S+)$/m)?.[1] ?? 'missing'])

    const features = readFileSync(resolve(repositoryRoot, 'resources/data/features.ts'), 'utf8')
    pins.push(['resources/data/features.ts', features.match(/^\s*'bun': '([^']+)'/m)?.[1] ?? 'missing'])

    expect(pins.length).toBeGreaterThan(8)
    expect(pins.filter(([, version]) => version !== pinnedVersion)).toEqual([])
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
