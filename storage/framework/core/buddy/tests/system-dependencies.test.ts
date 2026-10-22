import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describeSystemDependencies } from '../src/system-dependencies'

/**
 * stacksjs/stacks#2919: a scaffolded `craft: "^0.0.1"` that no registry can
 * install, and an unpinned pantry that turned it into a failed deploy.
 */
const root = resolve(import.meta.dir, '../../../../..')

describe('describeSystemDependencies', () => {
  it('fails a config/deps.ts that still declares craft, as July scaffolds do', () => {
    const scaffolded = `export const config = {\n  dependencies: {\n    craft: "^0.0.1",\n    "bun.com": "^1.3.0",\n  },\n}\n`
    const result = describeSystemDependencies(scaffolded)
    expect(result.status).toBe('fail')
    expect(result.message).toContain('craft-native.org')
    expect(result.message).toContain('Remove the line')
  })

  it('fails it behind a conditional spread too, which still installs on the opt-in path', () => {
    const gated = `const on = process.env.STACKS_SYSTEM_DEPS === "1"\nexport const config = { dependencies: { ...(on ? { craft: "^0.0.1", "bun.com": "^1.3.0" } : {}) } }\n`
    expect(describeSystemDependencies(gated).status).toBe('fail')
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
