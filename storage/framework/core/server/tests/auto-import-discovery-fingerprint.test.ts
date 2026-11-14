import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

// Exercise the public generator in a fresh process and disposable project.
// This catches generated artifact drift; it does not test package discovery itself.
async function withProject(run: (project: string, put: (file: string, source: string) => void) => Promise<void>): Promise<void> {
  const project = mkdtempSync(join(tmpdir(), 'stacks-discovery-fingerprint-'))
  const put = (file: string, source: string) => {
    const target = join(project, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
  }
  try {
    put('package.json', JSON.stringify({ name: 'discovery-fingerprint-fixture', type: 'module' }))
    put('resources/functions/probe.ts', 'export function projectProbe() {}\n')
    put('app/Models/Probe.ts', 'export default {}\n')
    await run(project, put)
  }
  finally {
    rmSync(project, { recursive: true, force: true })
  }
}

async function generate(project: string): Promise<Record<string, string>> {
  const generator = resolve(import.meta.dir, '../src/imports.ts')
  const child = Bun.spawn([process.execPath, '--eval', `
    const { generateAutoImportFiles } = await import(${JSON.stringify(generator)})
    await generateAutoImportFiles()
  `], { cwd: project, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect({ exit, diagnostics: exit ? stdout + stderr : '' }).toEqual({ exit: 0, diagnostics: '' })
  const files = [...new Bun.Glob('storage/framework/{auto-imports,types}/**/*').scanSync({ cwd: project, onlyFiles: true })]
  files.push('storage/framework/server-auto-imports.json')
  return Object.fromEntries(files.sort().map(file => [file, readFileSync(join(project, file), 'utf8')]))
}

test('cold and warm empty package discovery generate identical artifacts', async () => {
  await withProject(async (project, put) => {
    const cold = await generate(project)
    put('storage/framework/discovered-packages.json', JSON.stringify({ generated_at: '2026-11-14T19:35:49.149Z', packages: {} }))
    expect(await generate(project)).toEqual(cold)

    put('storage/framework/discovered-packages.json', JSON.stringify({ generated_at: '2026-11-15T19:35:49.149Z', packages: {} }))
    expect(await generate(project)).toEqual(cold)
  })
}, 30_000)

test('package order and timestamps are stable while package and source changes invalidate', async () => {
  await withProject(async (project, put) => {
    const empty = await generate(project)
    const first = { root: 'node_modules/first-package' }
    const second = { root: 'node_modules/second-package' }
    const discover = (packages: Record<string, { root: string }>, generated_at = '2026-11-14T19:35:49.149Z') => {
      put('storage/framework/discovered-packages.json', JSON.stringify({ generated_at, packages }))
    }
    const fingerprint = (files: Record<string, string>) => files['storage/framework/auto-imports/sources.json']

    discover({ first, second })
    const discovered = await generate(project)
    expect(fingerprint(discovered)).not.toBe(fingerprint(empty))

    discover({ second, first }, '2026-11-15T19:35:49.149Z')
    expect(await generate(project)).toEqual(discovered)

    discover({ first: { root: 'node_modules/moved-first-package' }, second })
    const moved = await generate(project)
    expect(fingerprint(moved)).not.toBe(fingerprint(discovered))

    put('app/Models/Added.ts', 'export default {}\n')
    const added = await generate(project)
    expect(fingerprint(added)).not.toBe(fingerprint(moved))
    expect(added['storage/framework/auto-imports/models.ts']).toContain('Added')

    discover({})
    expect(fingerprint(await generate(project))).not.toBe(fingerprint(added))
    rmSync(join(project, 'app/Models/Added.ts'))
    expect(await generate(project)).toEqual(empty)
  })
}, 30_000)
