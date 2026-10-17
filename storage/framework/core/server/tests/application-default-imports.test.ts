import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

test('normal application generation uses public defaults exports and remains byte stable', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-application-imports-'))
  const put = (file: string, source: string) => {
    const target = join(root, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
  }
  try {
    put('package.json', JSON.stringify({ name: 'application-import-fixture', type: 'module' }))
    const defaults = 'storage/framework/defaults'
    for (const category of ['Models', 'Jobs', 'Controllers', 'Actions', 'Listeners', 'Policies', 'Middleware'])
      put(`${defaults}/app/${category}/Probe.ts`, 'export default { marker: 42 }\n')
    put(`${defaults}/functions/probe.ts`, 'export function defaultProbe() { return 42 }\n')
    put(`${defaults}/resources/emails/probe.html`, '<p>Published template</p>\n')
    put('app/Actions/Override.ts', 'export default { marker: 7 }\n')
    put(`${defaults}/app/Actions/Override.ts`, 'export default { marker: 42 }\n')
    const generator = resolve(import.meta.dir, '../src/imports.ts')
    const source = `
      const { generateAutoImportFiles } = await import(${JSON.stringify(generator)})
      const snapshot = async () => {
        const files = [...new Bun.Glob('storage/framework/{auto-imports,types}/**/*').scanSync({ onlyFiles: true })].sort()
        return Promise.all(files.map(async file => [file, await Bun.file(file).text()]))
      }
      await generateAutoImportFiles()
      const first = await snapshot()
      await generateAutoImportFiles()
      if (JSON.stringify(first) !== JSON.stringify(await snapshot())) throw new Error('Generation changed on second run')
    `
    const child = Bun.spawn([process.execPath, '--eval', source], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ exit, diagnostics: exit ? stdout + stderr : '' }).toEqual({ exit: 0, diagnostics: '' })
    for (const file of ['models', 'jobs', 'controllers', 'actions', 'listeners', 'policies', 'middleware', 'emails', 'functions']) {
      const generated = readFileSync(join(root, `storage/framework/auto-imports/${file}.ts`), 'utf8')
      expect(generated).toContain('@stacksjs/defaults/')
      expect(generated).not.toContain('node_modules/')
      expect(generated).not.toContain('../defaults/')
    }
    const actions = readFileSync(join(root, 'storage/framework/auto-imports/actions.ts'), 'utf8')
    expect(actions).toContain('../../../app/Actions/Override.ts')
    expect(actions).not.toContain('@stacksjs/defaults/app/Actions/Override.ts')
    expect(readFileSync(join(root, 'storage/framework/types/server-auto-imports.d.ts'), 'utf8')).toContain('@stacksjs/defaults/app/Models/Probe.ts')
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
