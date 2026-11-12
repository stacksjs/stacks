import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { describeSystemDependencies } from '../src/system-dependencies'

/**
 * stacksjs/stacks#2919: the obsolete scaffold range cannot select later
 * published native releases, and an unpinned Pantry exposed it during deploy.
 */
const root = resolve(import.meta.dir, '../../../../..')

describe('describeSystemDependencies', () => {
  it('fails the obsolete ^0.0.1 dependency in July scaffolds', () => {
    const scaffolded = `export const config = {\n  dependencies: {\n    craft: "^0.0.1",\n    "bun.com": "^1.3.0",\n  },\n}\n`
    const result = describeSystemDependencies(scaffolded)
    expect(result.status).toBe('fail')
    expect(result.message).toContain('craft-native.org')
    expect(result.message).toContain('Remove the line')
    expect(result.message).toContain('declared range')
    expect(result.message).not.toContain('add --global')
  })

  it('fails it behind a conditional spread too, which still installs on the opt-in path', () => {
    const gated = `const on = process.env.STACKS_SYSTEM_DEPS === "1"\nexport const config = { dependencies: { ...(on ? { craft: "^0.0.1", "bun.com": "^1.3.0" } : {}) } }\n`
    expect(describeSystemDependencies(gated).status).toBe('fail')
  })

  it('allows an actual published native Craft range without claiming general range resolution', () => {
    const result = describeSystemDependencies(`export const config = { dependencies: { craft: '^0.0.499' } }`)
    expect(result.status).toBe('pass')
    expect(result.message).toContain('obsolete Craft')
    expect(result.message).not.toContain('registry cannot install')
  })

  it('allows native four-component versions and canonical domain declarations', () => {
    for (const entry of ["craft: '^0.0.350.1'", "'craft-native.org': '^0.0.499'"]) {
      expect(describeSystemDependencies(`export const config = { dependencies: { ${entry} } }`).status).toBe('pass')
    }
  })

  it('matches the whole obsolete range rather than a prefix of a wider request', () => {
    for (const range of ['^0.0.1 || ^0.0.499', '^0.0.10', '~0.0.1', '>=0.0.1']) {
      expect(describeSystemDependencies(`export const config = { dependencies: { craft: '${range}' } }`).status).toBe('pass')
    }
  })

  it('defers computed range expressions rather than diagnosing their literal prefix', () => {
    for (const value of [
      "'^0.0.1'.replace('1', '499')",
      "'^0.0.1' + ' || ^0.0.499'",
      "('^0.0.1').replace('1', '499')",
      "'^0.0.1'['replace']('1', '499')",
    ]) {
      expect(describeSystemDependencies(`export const config = { dependencies: { craft: ${value} } }`).status).toBe('pass')
    }
  })

  it('does not diagnose unrelated Craft keys outside dependency objects', () => {
    const source = `const example = { craft: '^0.0.1' }
export const config = { craft: '^0.0.1', tools: { craft: '^0.0.1' }, dependencies: { bun: '1.4.4' }, after: { craft: '^0.0.1' } }`
    expect(describeSystemDependencies(source).status).toBe('pass')
  })

  it('does not turn computed Craft keys into literal package declarations', () => {
    for (const key of ['craft', "'craft'"]) {
      const source = `const craft = 'other.dev'; export const config = { dependencies: { [${key}]: '^0.0.1' } }`
      expect(describeSystemDependencies(source).status).toBe('pass')
    }
  })

  it('does not turn a computed dependencies key into a dependency object', () => {
    const source = `const dependencies = 'metadata'
export const config = { [dependencies]: { craft: '^0.0.1' }, dependencies: { bun: '1.4.4' } }`
    expect(describeSystemDependencies(source).status).toBe('pass')
  })

  it('does not read object examples inside strings as declarations', () => {
    const source = `export const config = { dependencies: { bun: '1.4.4' }, note: "{ dependencies: { [craft]: '^0.0.1', craft: '^0.0.1' } }" }`
    expect(describeSystemDependencies(source).status).toBe('pass')
  })

  it("passes the framework's own config/deps.ts, whose comments mention craft", () => {
    const own = readFileSync(resolve(root, 'config/deps.ts'), 'utf8')
    expect(own).toContain('craft')
    expect(describeSystemDependencies(own).status).toBe('pass')
  })

  it('passes a commented-out craft entry and an unrelated key that merely contains the word', () => {
    expect(describeSystemDependencies(`export const config = { dependencies: {\n  // craft: '^0.0.1',\n  'aircraft.dev': '^1.0.0',\n} }\n`).status).toBe('pass')
  })
})

describe('the pantry bootstrap', () => {
  it('installs the version CI runs, not the latest release', () => {
    const installer = readFileSync(resolve(root, 'storage/framework/scripts/pantry-install'), 'utf8')
    const pinned = installer.match(/PANTRY_VERSION:-([0-9.]+)/)?.[1]
    expect(pinned).toBeDefined()

    const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8')
    const ciVersions = [...new Set([...ci.matchAll(/^\s+version: '([0-9.]+)'/gm)].map(match => match[1]))]
    expect(ciVersions).toEqual([pinned])
  })
})
