import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('built browser and STX entry points retain callable translator types for consumers', async () => {
  const root = resolve(import.meta.dir, '..')
  const build = Bun.spawn([process.execPath, '--conditions=development', 'build.ts'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [code, output, errors] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
  expect(code, output + errors).toBe(0)
  const folder = await mkdtemp(join(tmpdir(), 'stacks-i18n-types-'))
  try {
    const file = join(folder, 'consumer.ts')
    await writeFile(file, `
import { createI18n } from ${JSON.stringify(join(root, 'dist/client.js'))}
import { useI18n } from ${JSON.stringify(join(root, 'dist/stx.js'))}
for (const words of [createI18n(), useI18n()]) {
  const text: string = words.t('title')
  const plural: string = words.tc('items', 2)
  const exists: boolean = words.te('title')
  const number: string = words.n(1234)
  const date: string = words.d(new Date())
  words.setLocale('de')
  words.addTranslations('de', { title: 'Titel' })
  const stop: () => void = words.subscribe(() => {})
  stop()
  void [text, plural, exists, number, date, words.tm('section')]
}
`)
    const check = Bun.spawn([process.execPath, 'x', '--bun', 'tsc', '--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', '--module', 'preserve', '--moduleResolution', 'bundler', '--target', 'esnext', file], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [status, diagnostics, failure] = await Promise.all([check.exited, new Response(check.stdout).text(), new Response(check.stderr).text()])
    expect(status, diagnostics + failure).toBe(0)
  }
  finally { await rm(folder, { recursive: true, force: true }) }
}, 60_000)
