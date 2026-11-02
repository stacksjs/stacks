import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertIsolatedOk, runIsolated } from '../src/isolated'

test('the packed schema entry imports in a standalone fixture without test-runner hooks or a database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-schema-package-'))
  const packageRoot = join(import.meta.dir, '..')
  try {
    async function installPacked(name: 'testing' | 'cli'): Promise<string> {
      const source = join(packageRoot, '..', name)
      const archives = join(directory, 'archives', name)
      mkdirSync(archives, { recursive: true })
      assertIsolatedOk(await runIsolated(join(source, 'build.ts'), { cwd: source, preload: [], envFile: false, timeoutMs: 60_000 }))
      const pack = Bun.spawnSync([process.execPath, 'pm', 'pack', '--destination', archives], { cwd: source, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
      expect(pack.exitCode, Buffer.from(pack.stderr).toString()).toBe(0)
      const archive = readdirSync(archives).find(file => file.endsWith('.tgz'))
      expect(archive).toBeDefined()
      const target = join(directory, 'node_modules/@stacksjs', name)
      mkdirSync(target, { recursive: true })
      const unpack = Bun.spawnSync(['tar', '-xzf', join(archives, archive!), '-C', target, '--strip-components=1'], { stdout: 'pipe', stderr: 'pipe' })
      expect(unpack.exitCode, Buffer.from(unpack.stderr).toString()).toBe(0)
      return target
    }
    const installed = await installPacked('testing')
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}')
    const consumer = join(directory, 'consumer.ts')
    writeFileSync(consumer, `
import { applyTestSchema } from '@stacksjs/testing/schema'
import { freezeTime, travelTo, useRealTime } from '@stacksjs/testing/time'
const before = Date.now()
try {
  freezeTime('2024-01-15T10:00:00Z')
  if (new Date().toISOString() !== '2024-01-15T10:00:00.000Z') throw Error('packed clock did not freeze')
  travelTo('2024-06-01T00:00:00Z')
  if (new Date().toISOString() !== '2024-06-01T00:00:00.000Z') throw Error('packed clock did not travel')
}
finally { useRealTime() }
if (Math.abs(Date.now() - before) > 30_000) throw Error('packed clock was not restored')
await applyTestSchema([])
console.log('packed standalone schema OK')
`)
    assertIsolatedOk(await runIsolated(consumer, { cwd: directory, preload: [], envFile: false, timeoutMs: 10_000 }), 'packed standalone schema OK')
    // Schema/time do not load service ownership, CLI bootstrap or a database.
    expect(existsSync(join(directory, 'node_modules/@stacksjs/cli'))).toBe(false)
    const cli = await installPacked('cli')
    const testingManifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
    const cliManifest = JSON.parse(readFileSync(join(cli, 'package.json'), 'utf8'))
    expect(Bun.semver.satisfies(cliManifest.version, testingManifest.dependencies['@stacksjs/cli'])).toBe(true)
    writeFileSync(join(directory, 'bunfig.toml'), 'preload = []\n')
    const serviceConsumer = join(directory, 'service-consumer.ts')
    writeFileSync(serviceConsumer, `
import assert from 'node:assert/strict'
import { startTestService, notifyTestServiceReady } from '@stacksjs/testing/service'
if (notifyTestServiceReady() !== false) throw Error('standalone consumer received an unrequested IPC channel')
const program = "import { notifyTestServiceReady } from '@stacksjs/testing/service'; notifyTestServiceReady({ packed: true }); await Bun.sleep(60000)"
const service = startTestService([process.execPath, '--no-env-file', '--config=bunfig.toml', '--eval', program], { startupTimeoutMs: 5000, stopGraceMs: 50 })
const output = new Response(service.stdout).text()
const errors = new Response(service.stderr).text()
try { assert.deepEqual(await service.ready, { packed: true }) }
finally {
  await service.stop()
  await Promise.all([output, errors])
}
process.stdout.write('packed standalone service OK\\n')
`)
    assertIsolatedOk(await runIsolated(serviceConsumer, { cwd: directory, preload: [], envFile: false, timeoutMs: 10_000 }), 'packed standalone service OK')
    expect(await Bun.file(join(installed, 'dist/schema.d.ts')).text()).toContain('applyTestSchema(statements: readonly string[]): Promise<void>')
    expect(await Bun.file(join(installed, 'dist/time.d.ts')).text()).toContain('freezeTime(at?: TimeLike): Date')
    const service = await Bun.file(join(installed, 'dist/service.d.ts')).text()
    expect(service).toContain('startTestService(command: string[], options?: TestServiceOptions): TestService')
    expect(service).toContain('readonly signal: AbortSignal')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 120_000)
