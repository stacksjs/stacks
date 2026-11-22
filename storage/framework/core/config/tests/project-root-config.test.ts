/**
 * The project's `config/*.ts` load from the project root, not the working
 * directory (stacksjs/stacks#3356).
 *
 * The loader resolved them against `process.cwd()`, while `projectPath()`,
 * which the rest of the framework uses to find the project's models,
 * migrations and `.env`, climbs out of `storage/framework/...`. A process
 * started inside the framework tree therefore read the project's `.env` and
 * none of its config, and fell back to the framework defaults without a
 * warning: `config.database.default` was `sqlite` with DB_CONNECTION=postgres.
 *
 * The loader runs once per process, so each case starts a child in a
 * throwaway project.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const configEntry = join(import.meta.dir, '../src/index.ts')
const root = mkdtempSync(join(tmpdir(), 'stacks-config-root-'))
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'config-root-fixture', private: true }))
mkdirSync(join(root, 'config'))
writeFileSync(join(root, 'config/app.ts'), `export default { name: 'Fixture From Project Config' }\n`)
const packageDir = join(root, 'storage/framework/core/fixture')
mkdirSync(packageDir, { recursive: true })

afterAll(() => rmSync(root, { recursive: true, force: true }))

async function appNameFrom(cwd: string): Promise<{ name: string, stderr: string }> {
  const child = Bun.spawn([process.execPath, '-e', `
    const { config, overridesReady } = await import(${JSON.stringify(configEntry)})
    await overridesReady
    console.log('APP_NAME_IS=' + config.app.name)
    process.exit(0)
  `], {
    cwd,
    // APP_NAME is set explicitly so neither the parent's value nor an env
    // preload decides the answer; the project's config/app.ts outranks it.
    env: { ...process.env, APP_NAME: 'From The Environment', SKIP_CONFIG_VALIDATION: 'true' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { name: stdout.match(/APP_NAME_IS=(.*)/)?.[1] ?? '', stderr }
}

describe('project config resolution', () => {
  test('loads config/*.ts when started at the project root', async () => {
    const result = await appNameFrom(root)
    expect(result.name, result.stderr).toBe('Fixture From Project Config')
  }, 30_000)

  test('loads config/*.ts when started inside storage/framework', async () => {
    const result = await appNameFrom(packageDir)
    expect(result.name, result.stderr).toBe('Fixture From Project Config')
  }, 30_000)
})
