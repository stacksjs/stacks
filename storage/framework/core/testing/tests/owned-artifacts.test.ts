import { expect, test } from 'bun:test'
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('built public testing subpaths retain stdin, output, IPC and native descendant ownership without source aliases', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-owned-artifacts-'))
  const core = resolve(import.meta.dir, '../..')
  try {
    writeFileSync(join(root, 'package.json'), '{"type":"module"}\n')
    writeFileSync(join(root, 'bunfig.toml'), 'preload = []\n')
    for (const [name, entries] of [['cli', ['owned-process']], ['testing', ['isolated', 'service']]] as const) {
      const target = join(root, 'node_modules/@stacksjs', name)
      mkdirSync(target, { recursive: true })
      copyFileSync(join(core, name, 'package.json'), join(target, 'package.json'))
      const built = await Bun.build({ entrypoints: entries.map(entry => join(core, name, 'src', `${entry}.ts`)), outdir: join(target, 'dist'), target: 'bun', format: 'esm', packages: 'external', minify: true })
      expect(built.success, built.logs.map(String).join('\n')).toBe(true)
    }
    copyFileSync(join(import.meta.dir, '../fixtures/isolated/process-tree.ts'), join(root, 'tree.ts'))
    writeFileSync(join(root, 'echo.ts'), 'process.stdout.write(await Bun.stdin.text()); process.stderr.write("owned diagnostic"); process.exitCode = 7\n')
    writeFileSync(join(root, 'consumer.ts'), `
import assert from 'node:assert/strict'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { runIsolated } from '@stacksjs/testing/isolated'
import { startTestService } from '@stacksjs/testing/service'
const result = await runIsolated('echo.ts', { cwd: process.cwd(), bunfig: 'bunfig.toml', envFile: false, stdin: 'owned stdin ✓\\n' })
assert.equal(result.code, 7)
assert.equal(result.stdout, 'owned stdin ✓\\n')
assert.equal(result.stderr, 'owned diagnostic')
const owner = crypto.randomUUID()
const command = role => [process.execPath, '--no-env-file', '--config=' + join(process.cwd(), 'bunfig.toml'), 'tree.ts', role, process.cwd(), owner]
const unrelated = Bun.spawn(command('unrelated'), { stdout: 'ignore', stderr: 'ignore', stdin: 'ignore' })
const service = startTestService(command('service'), { startupTimeoutMs: 10000, stopGraceMs: 50, env: { ...process.env, OWNED_SERVICE_MODULE: '@stacksjs/testing/service' } })
const output = new Response(service.stdout).text()
const errors = new Response(service.stderr).text()
const endpoint = role => JSON.parse(readFileSync(role + '.json', 'utf8'))
const alive = async role => {
  try {
    const target = endpoint(role)
    const response = await fetch(target.origin, { headers: { 'x-fixture-owner': owner }, signal: AbortSignal.timeout(500) })
    return (await response.json()).owner === owner
  } catch { return false }
}
try {
  const deadline = performance.now() + 10000
  while (!existsSync('unrelated.json')) {
    assert(performance.now() < deadline, 'unrelated fixture did not start')
    await Bun.sleep(5)
  }
  assert.deepEqual(await service.ready, { role: 'service', owner })
  assert(await alive('child'))
  assert(await alive('grandchild'))
  assert(await alive('unrelated'))
  await service.stop()
  assert.equal(await alive('child'), false)
  assert.equal(await alive('grandchild'), false)
  assert(await alive('unrelated'))
  assert((await output).includes('owned tree ready'))
  assert.equal(await errors, '')
  unlinkSync('child.json')
  unlinkSync('grandchild.json')
  const timeout = await runIsolated('tree.ts', { cwd: process.cwd(), bunfig: 'bunfig.toml', envFile: false, args: ['root', process.cwd(), owner], timeoutMs: process.platform === 'win32' ? 8000 : 1000 })
  assert.equal(timeout.timedOut, true)
  assert.equal(timeout.code, null)
  assert(timeout.stdout.includes('owned tree ready'))
  assert.equal(await alive('child'), false)
  assert.equal(await alive('grandchild'), false)
  assert(await alive('unrelated'))
} finally {
  await service.stop()
  unrelated.kill('SIGKILL')
  await unrelated.exited
}
process.stdout.write('owned artifacts OK\\n')
`)
    const child = Bun.spawn([process.execPath, '--no-env-file', `--config=${join(root, 'bunfig.toml')}`, join(root, 'consumer.ts')], { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 30000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('owned artifacts OK')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 40000)
