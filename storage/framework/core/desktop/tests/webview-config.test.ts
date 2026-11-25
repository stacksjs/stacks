/**
 * A built web view app runs on the config compiled into it, and says which
 * config it booted with (stacksjs/stacks#3368).
 *
 * Config loads once per process, so each launch runs in a child started in a
 * throwaway project whose own config/app.ts names a different app.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderWebviewEntry } from '../src/webview-launcher'

const launcher = join(import.meta.dir, '../src/webview-launcher.ts')
const configEntry = join(import.meta.dir, '../../config/src/index.ts')
const root = mkdtempSync(join(tmpdir(), 'stacks-webview-config-'))
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'webview-config-fixture', private: true }))
mkdirSync(join(root, 'config'))
writeFileSync(join(root, 'config/app.ts'), `export default { name: 'From config/ On Disk' }\n`)
writeFileSync(join(root, 'compiled-app.ts'), `export default { name: 'Compiled Into The App' }\n`)
writeFileSync(join(root, 'compiled-broken.ts'), `throw new Error('cache config is broken')\n`)

afterAll(() => rmSync(root, { recursive: true, force: true }))

/** Launch the app in a child; the agent module reports the app name config resolved. */
async function launch(config: string | undefined, options: { awaitConfig?: boolean } = {}): Promise<{ code: number, seen?: string, opened: boolean, output: string }> {
  const script = join(root, `launch-${Math.random().toString(36).slice(2)}.ts`)
  writeFileSync(script, `
    import { runWebviewApp, } from ${JSON.stringify(launcher)}
    import { desktopAppPaths } from ${JSON.stringify(join(import.meta.dir, '../src/webview-agent.ts'))}
    let seen
    let opened = false
    const code = await runWebviewApp({
      manifest: { appName: 'Fixture', appId: 'org.example.fixture', version: '0.3.0', runtime: process.execPath, window: { title: 'Fixture', width: 8, height: 6 } },
      views: { kind: 'none' },
      paths: desktopAppPaths('Fixture', { platform: process.platform, home: ${JSON.stringify(root)} + '/home-' + Math.random().toString(36).slice(2), env: {} }),
      argv: [],
      logWhenDetached: false,
      ${config ? `config: ${config},` : ''}
      module: async () => {
        const { config, overridesReady } = await import(${JSON.stringify(configEntry)})
        ${options.awaitConfig === false ? '' : 'await overridesReady'}
        seen = config.app.name
        return {}
      },
      spawn: () => { opened = true; return { exited: Promise.resolve(0), kill: () => {} } },
    })
    console.log('RESULT=' + JSON.stringify({ code, seen, opened }))
    process.exit(0)
  `)
  const child = Bun.spawn([process.execPath, script], {
    cwd: root,
    env: { ...process.env, SKIP_CONFIG_VALIDATION: 'true', SKIP_CONFIG_LOADING: '', APP_NAME: 'From The Environment' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const result = JSON.parse(stdout.match(/RESULT=(.*)/)?.[1] ?? '{"code":-1}') as { code: number, seen?: string, opened: boolean }
  return { ...result, output: `${stdout}\n${stderr}` }
}

describe('the config a web view app boots with', () => {
  test('a built app runs on its compiled-in config, not on what sits beside it, and logs it', async () => {
    const result = await launch(`{ app: () => import(${JSON.stringify(join(root, 'compiled-app.ts'))}) }`)
    expect(result.code, result.output).toBe(0)
    expect(result.seen).toBe('Compiled Into The App')
    expect(result.output).toContain('[Fixture] config: app.ts compiled into the app; framework defaults for the rest')
  }, 30_000)

  // The module imports config and does not wait for it, as a compiled app's
  // does: the line is still written, once loading has finished.
  test('without compiled-in config the log says where config came from', async () => {
    const result = await launch(undefined, { awaitConfig: false })
    expect(result.code, result.output).toBe(0)
    expect(result.output).toMatch(/\[Fixture\] config: app\.ts from .*\/config; framework defaults for the rest/)
  }, 30_000)

  test('a compiled-in file that throws stops the start, says why, and opens no window', async () => {
    const result = await launch(`{ app: () => import(${JSON.stringify(join(root, 'compiled-app.ts'))}), cache: () => import(${JSON.stringify(join(root, 'compiled-broken.ts'))}) }`)
    expect(result.code, result.output).toBe(1)
    expect(result.seen).toBeUndefined()
    expect(result.opened).toBe(false)
    expect(result.output).toContain('config/cache.ts: cache config is broken')
  }, 30_000)
})

describe('the entrypoint the build writes', () => {
  test('names each config file in a static import(), so it is compiled in', () => {
    const entry = renderWebviewEntry({
      manifest: { appName: 'F', appId: 'org.f.app', version: '0.1.0', runtime: 'embedded', window: { title: 'F', width: 1, height: 2 } },
      configFiles: { 'app': '/p/config/app.ts', 'feature-flags': '/p/config/feature-flags.ts' },
      launcherModule: '@stacksjs/desktop-build',
    })
    expect(entry).toContain('config: {')
    expect(entry).toContain('"app": () => import("/p/config/app.ts"),')
    expect(entry).toContain('"feature-flags": () => import("/p/config/feature-flags.ts"),')
  })

  test('carries no config section when none is given', () => {
    const entry = renderWebviewEntry({ manifest: { appName: 'F', appId: 'org.f.app', version: '0.1.0', runtime: '/bin/craft', window: { title: 'F', width: 1, height: 2 } } })
    expect(entry).not.toContain('config: {')
  })
})
