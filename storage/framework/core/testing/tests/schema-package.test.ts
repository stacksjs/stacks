import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertIsolatedOk, runIsolated } from '../src/isolated'

test('the packed schema entry imports in a standalone fixture without test-runner hooks or a database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-schema-package-'))
  const packageRoot = join(import.meta.dir, '..')
  try {
    assertIsolatedOk(await runIsolated(join(packageRoot, 'build.ts'), { cwd: packageRoot, preload: [], envFile: false, timeoutMs: 60_000 }))
    const pack = Bun.spawnSync([process.execPath, 'pm', 'pack', '--destination', directory], { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
    expect(pack.exitCode, Buffer.from(pack.stderr).toString()).toBe(0)
    const archive = readdirSync(directory).find(file => file.endsWith('.tgz'))
    expect(archive).toBeDefined()
    const installed = join(directory, 'node_modules/@stacksjs/testing')
    mkdirSync(installed, { recursive: true })
    const unpack = Bun.spawnSync(['tar', '-xzf', join(directory, archive!), '-C', installed, '--strip-components=1'], { stdout: 'pipe', stderr: 'pipe' })
    expect(unpack.exitCode, Buffer.from(unpack.stderr).toString()).toBe(0)
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}')
    const consumer = join(directory, 'consumer.ts')
    writeFileSync(consumer, `
import { applyTestSchema } from '@stacksjs/testing/schema'
import { startTestService, notifyTestServiceReady } from '@stacksjs/testing/service'
import { freezeTime, travelTo, useRealTime } from '@stacksjs/testing/time'
if (typeof startTestService !== 'function' || notifyTestServiceReady() !== false) throw Error('standalone service export failed')
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
    expect(await Bun.file(join(installed, 'dist/schema.d.ts')).text()).toContain('applyTestSchema(statements: readonly string[]): Promise<void>')
    expect(await Bun.file(join(installed, 'dist/time.d.ts')).text()).toContain('freezeTime(at?: TimeLike): Date')
    const service = await Bun.file(join(installed, 'dist/service.d.ts')).text()
    expect(service).toContain('startTestService(command: string[], options?: TestServiceOptions): TestService')
    expect(service).toContain('readonly signal: AbortSignal')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 120_000)
