import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { renderViewsBuildScript, resolveWebviewComponents } from '../src/webview-app'
import { webviewComponentDirs } from '../src/webview-agent'

/**
 * A component name two directories define, drawn by the real stx: once by
 * the static build `buddy build:desktop` runs, once by the server
 * `buddy dev:desktop` starts. Both must pick the same file, or the app that
 * ships is not the app that was developed.
 *
 * The project lives under this package so its scripts resolve the installed
 * stx, and each half runs in its own process, as it does in the commands.
 */
const root = mkdtempSync(join(import.meta.dir, '.tmp-components-'))
const children: Array<{ kill: () => void }> = []
afterAll(() => {
  for (const child of children) child.kill()
  rmSync(root, { recursive: true, force: true })
})

mkdirSync(join(root, 'views'))
mkdirSync(join(root, 'app-components'))
mkdirSync(join(root, 'library-components'))
writeFileSync(join(root, 'views/index.stx'), '<html><body><main><Badge /></main></body></html>\n')
writeFileSync(join(root, 'app-components/Badge.stx'), '<span data-from="app">badge</span>\n')
writeFileSync(join(root, 'library-components/Badge.stx'), '<span data-from="library">badge</span>\n')

const drawnFrom = (html: string): string[] => [...html.matchAll(/data-from="([a-z]+)"/g)].map(match => match[1]!)

async function built(components: string[], name: string): Promise<string[]> {
  const script = join(root, `build-${name}.ts`)
  const outDir = join(root, `out-${name}`)
  writeFileSync(script, renderViewsBuildScript({ appName: 'Fixture', root, viewsDir: join(root, 'views'), outDir, components }))
  const run = Bun.spawn(['bun', script], { cwd: root, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, STX_DIR: join(root, `.stx-build-${name}`) } })
  children.push(run)
  const deadline = setTimeout(() => run.kill(), 60_000)
  const code = await run.exited
  clearTimeout(deadline)
  if (code !== 0) throw new Error(`The view build failed (${code}):\n${await new Response(run.stderr).text()}`)
  return drawnFrom(readFileSync(join(outDir, 'index.html'), 'utf8'))
}

async function served(components: string[], name: string): Promise<string[]> {
  const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('') })
  const port = probe.port
  await probe.stop(true)
  // The options startWebviewAgent hands stx's server.
  const options = { patterns: [join(root, 'views')], port, quiet: true, ...webviewComponentDirs(resolveWebviewComponents(root, components)) }
  const script = join(root, `serve-${name}.ts`)
  writeFileSync(script, `import { serve } from 'bun-plugin-stx/serve'\nvoid serve(${JSON.stringify(options)})\n`)
  const run = Bun.spawn(['bun', script], { cwd: root, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, STX_DIR: join(root, `.stx-serve-${name}`) } })
  children.push(run)
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`)
      if (response.ok) return drawnFrom(await response.text())
    }
    catch {
      // Not listening yet.
    }
    await Bun.sleep(250)
  }
  throw new Error('The stx server never answered.')
}

describe('a component two directories define', () => {
  test('is drawn from the first directory by the build and by the dev server alike', async () => {
    const components = ['app-components', 'library-components']
    const [build, dev] = await Promise.all([built(components, 'app-first'), served(components, 'app-first')])
    expect(build).toEqual(['app'])
    expect(dev).toEqual(build)
  }, 90_000)

  test('and follows the order the config lists them in, in both', async () => {
    const components = ['library-components', 'app-components']
    const [build, dev] = await Promise.all([built(components, 'library-first'), served(components, 'library-first')])
    expect(build).toEqual(['library'])
    expect(dev).toEqual(build)
  }, 90_000)
})
