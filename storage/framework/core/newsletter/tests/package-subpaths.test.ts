import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('a built newsletter package ships the JavaScript behind every public subpath', async () => {
  const root = join(import.meta.dir, '..')
  const build = Bun.spawn([process.execPath, 'run', 'build'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
  expect(code, `${stdout}\n${stderr}`).toBe(0)
  const consumer = mkdtempSync(join(tmpdir(), 'newsletter-consumer-'))
  try {
    const manifest = await Bun.file(join(root, 'package.json')).json()
    for (const subpath of ['lists', 'subscriptions', 'campaigns', 'delivery', 'headers', 'newsletter', 'sync', 'usage', 'types']) {
      const target = join(root, manifest.exports['./*'].bun.replace('*', subpath))
      expect(await Bun.file(target).exists(), subpath).toBe(true)
    }
    // Resolve through package exports in a consumer, rather than workspace aliases.
    const { mkdirSync, symlinkSync } = await import('node:fs')
    mkdirSync(join(consumer, 'node_modules/@stacksjs'), { recursive: true })
    symlinkSync(root, join(consumer, 'node_modules/@stacksjs/newsletter'))
    writeFileSync(join(consumer, 'probe.ts'), `for (const name of ['lists','subscriptions','campaigns','headers']) console.log(Bun.resolveSync('@stacksjs/newsletter/' + name, import.meta.dir))`)
    const child = Bun.spawn([process.execPath, '--no-env-file', join(consumer, 'probe.ts')], { cwd: consumer, stdout: 'pipe', stderr: 'pipe' })
    const [result, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(result, error).toBe(0)
    expect(output.trim().split('\n')).toHaveLength(4)
  }
  finally { rmSync(consumer, { recursive: true, force: true }) }
}, 30000)
