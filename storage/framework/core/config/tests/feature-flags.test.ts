import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { feature, listFeatures } from '../src/features'
import { config } from '../src/runtime'

/**
 * What `feature()` accepts, and what it answers for (stacksjs/stacks#2867).
 *
 * `feature(name: string)` made `feature('commrce')` a silent `false`. It now
 * takes the framework's names plus whatever an app declares in
 * `AppFeatureFlags`, so a typo is a compile error and an app's own flag still
 * works once declared. Checked with the real compiler, since test files are
 * outside every tsconfig and an `@ts-expect-error` here would prove nothing.
 */
describe('feature() names', () => {
  const root = join(import.meta.dir, '../../../../..')
  const dir = join(import.meta.dir, '.tmp-feature-flag-types')
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  function compile(name: string, source: string): string[] {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${name}.ts`), source)
    // Extends the framework config so `@stacksjs/config` resolves to source.
    writeFileSync(join(dir, `tsconfig.${name}.json`), JSON.stringify({
      extends: '../../../../tsconfig.framework.json',
      include: [`${name}.ts`],
      exclude: [],
    }))
    const tsc = Bun.spawnSync([process.execPath, join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', join(dir, `tsconfig.${name}.json`)], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    return `${tsc.stdout}${tsc.stderr}`.split('\n').filter(line => line.includes('error TS'))
  }

  it('makes a misspelled or undeclared name a compile error', () => {
    const errors = compile('typo', [
      `import { enableFeature, feature } from '@stacksjs/config'`,
      `feature('commerce')`,
      `feature('auth')`,
      `feature('email')`,
      `feature('commrce')`,
      `enableFeature('new-checkout')`,
      '',
    ].join('\n'))

    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain(`typo.ts(5,9): error TS2345: Argument of type '"commrce"'`)
    expect(errors[1]).toContain(`typo.ts(6,15): error TS2345: Argument of type '"new-checkout"'`)
  }, 60_000)

  it('accepts a flag the app declares for itself', () => {
    const errors = compile('declared', [
      `import { enableFeature, feature } from '@stacksjs/config'`,
      `declare module '@stacksjs/config' {`,
      `  interface AppFeatureFlags { 'new-checkout': true }`,
      `}`,
      `enableFeature('new-checkout')`,
      `feature('new-checkout')`,
      '',
    ].join('\n'))

    expect(errors).toEqual([])
  }, 60_000)
})

describe('the gates feature() answers for', () => {
  it('reports email beside auth, the gate only the router used to know', () => {
    const names = Object.keys(listFeatures())
    expect(names).toContain('auth')
    expect(names).toContain('email')
  })

  it('forces email on in canonical mode, like every other framework name', () => {
    // Switched off in config, which canonical mode exists to ignore: generated
    // artifacts must not depend on one machine's config.
    const email = (config as unknown as { email: { enabled?: boolean } }).email
    const declared = email.enabled
    const before = process.env.STACKS_CANONICAL_FEATURES
    try {
      email.enabled = false
      delete process.env.STACKS_CANONICAL_FEATURES
      expect(feature('email')).toBe(false)

      process.env.STACKS_CANONICAL_FEATURES = '1'
      expect(feature('email')).toBe(true)
    }
    finally {
      email.enabled = declared
      if (before === undefined)
        delete process.env.STACKS_CANONICAL_FEATURES
      else
        process.env.STACKS_CANONICAL_FEATURES = before
    }
  })
})
