/**
 * A compiled app's config comes from the loaders its build compiled in, and
 * the process can say which config it booted with (stacksjs/stacks#3368).
 *
 * A compiled app has no config/ beside it, and the loader's `import()` of a
 * computed path is one the bundler cannot follow, so such an app fell back to
 * the framework defaults without a word. The loader runs once per process, so
 * each case starts a child in a throwaway project.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeConfigSource, userConfigFileNames } from '../src/sources'

const configEntry = join(import.meta.dir, '../src/index.ts')
const sourcesEntry = join(import.meta.dir, '../src/sources.ts')
const root = mkdtempSync(join(tmpdir(), 'stacks-config-bundled-'))
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'config-bundled-fixture', private: true }))
mkdirSync(join(root, 'config'))
writeFileSync(join(root, 'config/app.ts'), `export default { name: 'From config/ On Disk' }\n`)
writeFileSync(join(root, 'bundled-app.ts'), `export default { name: 'Compiled Into The App' }\n`)
writeFileSync(join(root, 'bundled-broken.ts'), `throw new Error('cache config is broken')\n`)

afterAll(() => rmSync(root, { recursive: true, force: true }))

async function run(script: string): Promise<{ out: Record<string, unknown>, stderr: string }> {
  const child = Bun.spawn([process.execPath, '-e', script], {
    cwd: root,
    env: { ...process.env, APP_NAME: 'From The Environment', SKIP_CONFIG_VALIDATION: 'true', SKIP_CONFIG_LOADING: '' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const line = stdout.match(/RESULT=(.*)/)?.[1]
  return { out: line ? JSON.parse(line) : {}, stderr }
}

describe('bundled config', () => {
  test('a registered bundle is what the app boots with, not config/ on disk', async () => {
    const { out, stderr } = await run(`
      const { registerBundledConfig } = await import(${JSON.stringify(sourcesEntry)})
      registerBundledConfig({ app: () => import(${JSON.stringify(join(root, 'bundled-app.ts'))}) })
      const { config, overridesReady, configSource } = await import(${JSON.stringify(configEntry)})
      await overridesReady
      console.log('RESULT=' + JSON.stringify({ name: config.app.name, source: configSource() }))
      process.exit(0)
    `)
    expect(out.name, stderr).toBe('Compiled Into The App')
    expect(out.source).toEqual({ from: 'bundled', loaded: ['app'], failed: [] })
  }, 30_000)

  test('without a bundle the files under the project root load, and the source names them', async () => {
    const { out, stderr } = await run(`
      const { config, overridesReady, configSource } = await import(${JSON.stringify(configEntry)})
      await overridesReady
      console.log('RESULT=' + JSON.stringify({ name: config.app.name, source: configSource() }))
      process.exit(0)
    `)
    expect(out.name, stderr).toBe('From config/ On Disk')
    expect(out.source).toMatchObject({ from: 'files', loaded: ['app'], failed: [] })
    expect(String((out.source as { root?: string }).root)).toEndWith(root.split('/').pop()!)
  }, 30_000)

  test('a compiled-in file that throws is recorded as failed, not taken for absent', async () => {
    const { out, stderr } = await run(`
      const { registerBundledConfig } = await import(${JSON.stringify(sourcesEntry)})
      registerBundledConfig({
        app: () => import(${JSON.stringify(join(root, 'bundled-app.ts'))}),
        cache: () => import(${JSON.stringify(join(root, 'bundled-broken.ts'))}),
      })
      const { overridesReady, configSource } = await import(${JSON.stringify(configEntry)})
      await overridesReady
      console.log('RESULT=' + JSON.stringify({ source: configSource() }))
      process.exit(0)
    `)
    expect(out.source, stderr).toEqual({ from: 'bundled', loaded: ['app'], failed: [{ name: 'cache', error: 'cache config is broken' }] })
    expect(stderr).toContain('config/cache.ts (compiled in)')
  }, 30_000)

  test('registering after config has loaded from disk throws instead of being ignored', async () => {
    const { out, stderr } = await run(`
      const { overridesReady, registerBundledConfig } = await import(${JSON.stringify(configEntry)})
      await overridesReady
      let error = ''
      try { registerBundledConfig({}) } catch (e) { error = e.message }
      console.log('RESULT=' + JSON.stringify({ error }))
      process.exit(0)
    `)
    expect(String(out.error), stderr).toContain('already loaded from config/ on disk')
  }, 30_000)
})

describe('describeConfigSource', () => {
  test('names the files and where they came from', () => {
    expect(describeConfigSource({ from: 'bundled', loaded: ['app', 'database'], failed: [] }))
      .toBe('config: app.ts, database.ts compiled into the app; framework defaults for the rest')
    expect(describeConfigSource({ from: 'files', root: '/srv/app', loaded: ['app'], failed: [{ name: 'cache', error: 'boom' }] }))
      .toBe('config: app.ts from /srv/app/config; framework defaults for the rest; failed: cache.ts (boom)')
  })

  test('says so when nothing loaded, rather than staying silent', () => {
    expect(describeConfigSource({ from: 'files', root: '/srv/app', loaded: [], failed: [] }))
      .toBe('config: no config/*.ts under /srv/app, framework defaults throughout')
    expect(describeConfigSource({ from: 'bundled', loaded: [], failed: [] }))
      .toBe('config: no config/*.ts compiled into the app, framework defaults throughout')
  })

  test('the file names a build compiles in include the alternative stx name', () => {
    expect(userConfigFileNames()).toContain('feature-flags')
    expect(userConfigFileNames()).toContain('stx')
    expect(userConfigFileNames()).toContain('ui')
  })
})
