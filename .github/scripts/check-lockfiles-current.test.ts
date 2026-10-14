import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { declaredSystemDependencies, driftIsPlatformOnly, packageName, pantryLockDrift } from './check-lockfiles-current'

/**
 * The line between a platform difference and a stale lockfile.
 *
 * `pantry.lock` resolves the transitive closure of the declared system
 * dependencies, and that closure is platform-specific: a Linux runner pulls a
 * GCC toolchain macOS never needs. The file is written wherever the person
 * regenerating it works, so a strict comparison can only pass on that
 * platform, which is what had the compile job red (stacksjs/stacks#2899).
 *
 * Tolerating the difference costs the guarantee only if "added" is read
 * loosely. A declared dependency cannot appear out of an install: if one does,
 * somebody declared it and never committed the lockfile, which is the case
 * this guard was written for and still fails.
 */

const lock = (packages: Record<string, unknown>, system: Record<string, string> = { 'curl.se': '^8.22.0' }): string =>
  JSON.stringify({ version: '1.0.0', lockfileVersion: 2, workspaces: { '': { name: 'stacks', system } }, packages })

const resolved = (version: string) => ({ version, source: 'pantry' })

describe('a package key', () => {
  it('names the package, whatever the name holds', () => {
    expect(packageName('gnu.org/gmp@6.3.0')).toBe('gnu.org/gmp')
    expect(packageName('gnu.org/gcc/libstdcxx@14.3.0')).toBe('gnu.org/gcc/libstdcxx')
    // The leading `@` of an npm scope is not the version separator.
    expect(packageName('@anthropic-ai/claude-agent-sdk@0.3.296')).toBe('@anthropic-ai/claude-agent-sdk')
    expect(packageName('bun.sh')).toBe('bun.sh')
  })
})

describe('declared system dependencies', () => {
  it('are collected across every workspace', () => {
    const declared = declaredSystemDependencies({
      workspaces: {
        '': { system: { 'bun.sh': '1.4.2' } },
        'storage/framework': { system: { 'sqlite.org': '^3.53.4' } },
        'storage/framework/core': {},
      },
    })

    expect([...declared].sort()).toEqual(['bun.sh', 'sqlite.org'])
  })
})

describe('drift a platform explains', () => {
  it('tolerates a closure nobody declared, which is the real case', () => {
    const drift = pantryLockDrift(
      lock({ 'curl.se@8.22.0': resolved('8.22.0') }),
      lock({ 'curl.se@8.22.0': resolved('8.22.0'), 'gnu.org/gmp@6.3.0': resolved('6.3.0'), 'gnu.org/mpfr@4.2.2': resolved('4.2.2') }),
    )

    expect(drift.added).toEqual(['gnu.org/gmp@6.3.0', 'gnu.org/mpfr@4.2.2'])
    expect(drift.declaredAdded).toEqual([])
    expect(driftIsPlatformOnly(drift)).toBe(true)
  })

  it('refuses a removal, which no platform performs', () => {
    const drift = pantryLockDrift(
      lock({ 'curl.se@8.22.0': resolved('8.22.0'), 'gnu.org/gmp@6.3.0': resolved('6.3.0') }),
      lock({ 'curl.se@8.22.0': resolved('8.22.0') }),
    )

    expect(drift.removed).toEqual(['gnu.org/gmp@6.3.0'])
    expect(driftIsPlatformOnly(drift)).toBe(false)
  })

  it('refuses a resolution that changed under the same key', () => {
    const drift = pantryLockDrift(
      lock({ 'curl.se@8.22.0': resolved('8.22.0') }),
      lock({ 'curl.se@8.22.0': resolved('8.23.1') }),
    )

    expect(drift.changed).toEqual(['curl.se@8.22.0'])
    expect(driftIsPlatformOnly(drift)).toBe(false)
  })

  it('refuses a declared dependency the lockfile never recorded', () => {
    // The guard's original purpose: a system dependency added to a workspace
    // and committed without the lockfile, which the install then fills in.
    const drift = pantryLockDrift(
      lock({ 'curl.se@8.22.0': resolved('8.22.0') }, { 'curl.se': '^8.22.0', 'sqlite.org': '^3.53.4' }),
      lock({ 'curl.se@8.22.0': resolved('8.22.0'), 'sqlite.org@3.53.4': resolved('3.53.4') }, { 'curl.se': '^8.22.0', 'sqlite.org': '^3.53.4' }),
    )

    expect(drift.declaredAdded).toEqual(['sqlite.org@3.53.4'])
    expect(driftIsPlatformOnly(drift)).toBe(false)
  })

  it('refuses a change outside the packages map', () => {
    const drift = pantryLockDrift(
      lock({ 'curl.se@8.22.0': resolved('8.22.0') }, { 'curl.se': '^8.22.0' }),
      lock({ 'curl.se@8.22.0': resolved('8.22.0') }, { 'curl.se': '^9.0.0' }),
    )

    expect(drift.outsidePackages).toBe(true)
    expect(driftIsPlatformOnly(drift)).toBe(false)
  })
})

describe('the committed pantry.lock', () => {
  const contents = readFileSync(resolve(import.meta.dir, '..', '..', 'pantry.lock'), 'utf8')

  it('resolves every system dependency a workspace declares', () => {
    // The invariant tolerance rests on: a declared dependency is always in
    // `packages` already, so one appearing from an install is a stale file.
    const parsed = JSON.parse(contents) as { packages?: Record<string, unknown> }
    const names = new Set(Object.keys(parsed.packages ?? {}).map(packageName))
    const missing = [...declaredSystemDependencies(JSON.parse(contents))].filter(name => !names.has(name))

    expect(missing).toEqual([])
  })

  it('is unchanged by a no-op comparison with itself', () => {
    expect(driftIsPlatformOnly(pantryLockDrift(contents, contents))).toBe(true)
  })
})
