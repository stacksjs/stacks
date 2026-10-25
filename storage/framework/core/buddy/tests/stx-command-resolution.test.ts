import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

test('bun run stx invokes the installed compiler instead of Buddy', async () => {
  const root = resolve(import.meta.dir, '../../../../..')
  const compiler = JSON.parse(readFileSync(resolve(root, 'node_modules/@stacksjs/stx/package.json'), 'utf8'))
  const child = Bun.spawn([process.execPath, 'run', 'stx', '--version'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 10_000,
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  expect(code, stderr).toBe(0)
  expect(stdout).toContain(compiler.version)
  expect(stdout).not.toContain('buddy/')
}, 15_000)
