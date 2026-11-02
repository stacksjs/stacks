import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const checkout = fileURLToPath(new URL('../../../../../', import.meta.url))
const configs = ['tsconfig.app.json', 'tsconfig.framework.json', 'tsconfig.defaults.json', 'core/tsconfig.json', 'core/tsconfig.build.json']

// Real Bun resolution through the maintained configs catches namespace capture;
// it does not claim native host execution or package publication acceptance.
test.each(configs)('%s preserves external package identity beside a renamed workspace package', async (config) => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-workspace-resolution-'))
  const put = async (path: string, source: string) => {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  try {
    for (const name of [...configs, 'tsconfig.base.json'])
      await put(`storage/framework/${name}`, await readFile(join(checkout, 'storage/framework', name), 'utf8'))
    await put('storage/framework/core/desktop/package.json', JSON.stringify({ name: '@stacksjs/desktop-build', exports: { '.': './dist/index.js', './public': './dist/public.js' } }))
    await put('storage/framework/core/desktop/src/index.ts', 'export const buildDesktop = () => "workspace build"')
    await put('storage/framework/core/desktop/src/public.ts', 'export const buildPublic = () => "workspace public"')
    await put('node_modules/@stacksjs/desktop/package.json', JSON.stringify({ name: '@stacksjs/desktop', type: 'module', exports: { '.': './index.js' } }))
    await put('node_modules/@stacksjs/desktop/index.js', 'export const createWindow = () => "external window"')
    await put('probe.ts', 'import {createWindow} from "@stacksjs/desktop"; import {buildDesktop} from "@stacksjs/desktop-build"; import {buildPublic} from "@stacksjs/desktop-build/public"; import {buildDesktop as umbrellaDesktop} from "stacks/desktop"; console.log(JSON.stringify([createWindow(),buildDesktop(),buildPublic(),umbrellaDesktop()]))')
    const child = Bun.spawn([process.execPath, '--no-env-file', '--tsconfig-override', join(root, 'storage/framework', config), join(root, 'probe.ts')], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ code, stderr, stdout: stdout.trim() }).toEqual({ code: 0, stderr: '', stdout: '["external window","workspace build","workspace public","workspace build"]' })
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
