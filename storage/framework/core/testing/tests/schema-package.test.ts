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
    writeFileSync(consumer, "import { applyTestSchema } from '@stacksjs/testing/schema'\nawait applyTestSchema([])\nconsole.log('packed standalone schema OK')\n")
    assertIsolatedOk(await runIsolated(consumer, { cwd: directory, preload: [], envFile: false, timeoutMs: 10_000 }), 'packed standalone schema OK')
    expect(await Bun.file(join(installed, 'dist/schema.d.ts')).text()).toContain('applyTestSchema(statements: readonly string[]): Promise<void>')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 120_000)
