import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

/*
 * Resolved from this file, not the working directory.
 *
 * `resolve('storage/framework/...')` only found the models when the suite was
 * run from the repository root; running it from this package — which is what
 * `bun test` in `core/orm` does — looked for
 * `core/orm/storage/framework/...` and died on ENOENT. The model imports above
 * are already relative to this file, so the directory scan should be too.
 */
const modelsRoot = resolve(import.meta.dir, '../../../defaults/app/Models')
const ormSource = readFileSync(resolve(import.meta.dir, '../src/index.ts'), 'utf8')

function modelFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return modelFiles(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [path]
      : []
  })
}

describe('framework model exports', () => {
  test('exports and loads every default model through @stacksjs/orm', () => {
    const specialModels = new Set(['User', 'Job', 'FailedJob'])

    for (const file of modelFiles(modelsRoot)) {
      const name = basename(file, '.ts')
      const exportName = name === 'Error' ? 'ErrorModel' : name

      expect(ormSource).toContain(`export const ${exportName} = lazyModel<`)
      if (!specialModels.has(name))
        expect(ormSource).toContain(`['${name}', [`)
    }
  })

  test('loads referral exports only when auth is enabled', async () => {
    for (const enabled of [true, false]) {
      const script = `
        import assert from 'node:assert/strict'
        const { enableFeature, disableFeature } = await import(${JSON.stringify(resolve(import.meta.dir, '../../config/src/features.ts'))})
        ${enabled ? 'enableFeature' : 'disableFeature'}('auth')
        const { ormReady, Referral, ReferralCode } = await import(${JSON.stringify(resolve(import.meta.dir, '../src/index.ts'))})
        await ormReady
        assert.equal(Referral.getDefinition?.().table, ${enabled ? "'referrals'" : 'undefined'})
        assert.equal(ReferralCode.getDefinition?.().table, ${enabled ? "'referral_codes'" : 'undefined'})
        console.log('referral-exports-ok')
      `
      const child = Bun.spawn([process.execPath, '-e', script], {
        cwd: resolve(import.meta.dir, '../../../../..'),
        env: { ...process.env, DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: ':memory:' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(code, stderr).toBe(0)
      expect(stdout).toContain('referral-exports-ok')
    }
  })
})
