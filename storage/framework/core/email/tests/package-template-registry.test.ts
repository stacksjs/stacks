import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

for (const broken of [false, true]) {
  test(`package template registry ${broken ? 'surfaces a broken export on every attempt' : 'resolves a public raw template'}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-package-template-'))
    const put = (file: string, source: string) => {
      const target = join(root, file)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, source)
    }
    try {
      put('package.json', JSON.stringify({ name: 'package-template-fixture', type: 'module' }))
      const exports = JSON.parse(readFileSync(resolve(import.meta.dir, '../../defaults/package.json'), 'utf8')).exports
      put('node_modules/@stacksjs/defaults/package.json', JSON.stringify({ name: '@stacksjs/defaults', type: 'module', exports }))
      put('node_modules/@stacksjs/defaults/resources/emails/probe.html', '<p>PACKAGE-TEMPLATE</p>')
      put('resources/emails/probe.html', '<p>FALLBACK-MUST-NOT-HIDE-ERROR</p>')
      put('storage/framework/auto-imports/emails.ts', `export const emails = { probe: '@stacksjs/defaults/resources/emails/${broken ? 'missing' : 'probe'}.html' }\n`)
      const module = resolve(import.meta.dir, '../src/template.ts')
      const source = `
        const { templateExists, template } = await import(${JSON.stringify(module)})
        if (${broken}) {
          for (let attempt = 0; attempt < 2; attempt++) {
            let failed = false
            try { templateExists('probe') } catch { failed = true }
            if (!failed) throw new Error('Broken public export was concealed')
          }
        } else {
          if (!templateExists('probe')) throw new Error('Public template missing')
          const result = await template('probe', { layout: false, inlineCss: false })
          if (!result.html.includes('PACKAGE-TEMPLATE') || result.html.includes('FALLBACK-MUST')) throw new Error('Wrong template selected')
        }
      `
      const child = Bun.spawn([process.execPath, '--eval', source], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
      const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect({ exit, diagnostics: exit ? stdout + stderr : '' }).toEqual({ exit: 0, diagnostics: '' })
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
}
