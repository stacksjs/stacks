import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

for (const withCore of [false, true]) {
  test(`${withCore ? 'an app with native core sources' : 'a package app'} generates resolvable defaults with stable imports`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-application-imports-'))
    const put = (file: string, source: string) => {
      const target = join(root, file)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, source)
    }
    try {
      put('package.json', JSON.stringify({ name: 'application-import-fixture', type: 'module' }))
      if (withCore) {
        put('storage/framework/core/package.json', JSON.stringify({ name: 'stacks' }))
        put('storage/framework/core/defaults/package.json', JSON.stringify({ name: '@stacksjs/defaults' }))
      }
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
        if (${withCore}) {
          const models = await import('./storage/framework/auto-imports/models.ts')
          if (models.Probe.marker !== 42) throw new Error('Native source model did not resolve')
        }
      `
      const child = Bun.spawn([process.execPath, '--eval', source], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
      const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect({ exit, diagnostics: exit ? stdout + stderr : '' }).toEqual({ exit: 0, diagnostics: '' })
      for (const file of ['models', 'jobs', 'controllers', 'actions', 'listeners', 'policies', 'middleware', 'emails', 'functions']) {
        const generated = readFileSync(join(root, `storage/framework/auto-imports/${file}.ts`), 'utf8')
        expect(generated).toContain(withCore ? '../defaults/' : '@stacksjs/defaults/')
        expect(generated).not.toContain('node_modules/')
        if (!withCore) expect(generated).not.toContain('../defaults/')
      }
      const actions = readFileSync(join(root, 'storage/framework/auto-imports/actions.ts'), 'utf8')
      expect(actions).toContain('../../../app/Actions/Override.ts')
      expect(actions).not.toContain('@stacksjs/defaults/app/Actions/Override.ts')
      expect(readFileSync(join(root, 'storage/framework/types/server-auto-imports.d.ts'), 'utf8')).toContain(withCore ? '../defaults/app/Models/Probe' : '@stacksjs/defaults/app/Models/Probe.ts')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
}
