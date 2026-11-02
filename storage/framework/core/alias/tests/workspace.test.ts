import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateWorkspaceAliases, workspaceConfigs } from '../../../../../.github/scripts/generate-workspace-aliases'
import { alias, workspaceSourceAliases } from '../src/index'

const checkout = fileURLToPath(new URL('../../../../../', import.meta.url))

test('source aliases use real manifest names and only declared package and umbrella exports', async () => {
  const core = await mkdtemp(join(tmpdir(), 'stacks-workspace-aliases-'))
  const put = async (path: string, value: string) => {
    await mkdir(dirname(join(core, path)), { recursive: true })
    await writeFile(join(core, path), value)
  }
  try {
    await put('package.json', JSON.stringify({ name: 'stacks', exports: { '.': './dist/desktop.js', './desktop': './dist/desktop.js' } }))
    await put('desktop/package.json', JSON.stringify({ name: '@stacksjs/desktop-build', exports: { '.': './dist/index.js', './public': './dist/public.js', './blocked': { bun: null, import: './dist/public.js' } } }))
    await put('desktop/src/index.ts', 'export const buildDesktop = true')
    await put('desktop/src/public.ts', 'export const buildPublic = true')
    await put('desktop/src/private.ts', 'export const privateImplementation = true')
    expect(workspaceSourceAliases(core)).toEqual({
      '@stacksjs/desktop-build': join(core, 'desktop/src/index.ts'),
      '@stacksjs/desktop-build/public': join(core, 'desktop/src/public.ts'),
      'stacks': join(core, 'desktop/src/index.ts'),
      'stacks/desktop': join(core, 'desktop/src/index.ts'),
    })
    expect(alias['@stacksjs/desktop']).toBeUndefined()
    expect(alias['@stacksjs/desktop-build']).toContain('core/desktop/src/index.ts')
  }
  finally { await rm(core, { recursive: true, force: true }) }
})

test('duplicate identities and missing source exports fail before any config is written', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-aliases-invalid-')), core = join(root, 'storage/framework/core')
  try {
    await mkdir(join(core, 'a'), { recursive: true })
    await mkdir(join(core, 'b'))
    await writeFile(join(core, 'a/package.json'), JSON.stringify({ name: 'duplicate' }))
    await writeFile(join(core, 'b/package.json'), JSON.stringify({ name: 'duplicate' }))
    for (const name of workspaceConfigs) {
      const target = join(root, 'storage/framework', name)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, '{\n  "compilerOptions": {\n    "paths": {\n    }\n  }\n}\n')
    }
    const originals = await Promise.all(workspaceConfigs.map(name => readFile(join(root, 'storage/framework', name), 'utf8')))
    expect(() => generateWorkspaceAliases(root)).toThrow('Duplicate workspace package name: duplicate')
    await rm(join(core, 'b'), { recursive: true })
    await writeFile(join(core, 'a/package.json'), JSON.stringify({ name: 'a', exports: { '.': './dist/missing.js' } }))
    expect(() => generateWorkspaceAliases(root)).toThrow('Missing workspace export source: a -> ./dist/missing.js')
    expect(await Promise.all(workspaceConfigs.map(name => readFile(join(root, 'storage/framework', name), 'utf8')))).toEqual(originals)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('maintained source configs are current with package manifests and public exports', () => {
  expect(() => generateWorkspaceAliases(checkout, true)).not.toThrow()
})

test('generated workspace configs remain current after a CRLF checkout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-aliases-crlf-')), core = join(root, 'storage/framework/core')
  try {
    await mkdir(join(core, 'a/src'), { recursive: true })
    await writeFile(join(core, 'package.json'), JSON.stringify({ name: 'stacks', exports: { './a': './dist/a.js' } }))
    await writeFile(join(core, 'a/package.json'), JSON.stringify({ name: '@stacksjs/a', exports: { '.': './dist/index.js' } }))
    await writeFile(join(core, 'a/src/index.ts'), 'export const a = true')
    for (const name of workspaceConfigs) {
      const path = join(root, 'storage/framework', name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, '{\n  "compilerOptions": {\n    "paths": {\n    }\n  }\n}\n')
    }
    generateWorkspaceAliases(root)
    for (const name of workspaceConfigs) {
      const path = join(root, 'storage/framework', name)
      await writeFile(path, (await readFile(path, 'utf8')).replaceAll('\n', '\r\n'))
    }
    const checkedOut = await Promise.all(workspaceConfigs.map(name => readFile(join(root, 'storage/framework', name), 'utf8')))
    expect(() => generateWorkspaceAliases(root, true)).not.toThrow()
    generateWorkspaceAliases(root)
    expect(await Promise.all(workspaceConfigs.map(name => readFile(join(root, 'storage/framework', name), 'utf8')))).toEqual(checkedOut)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
