import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// stacksjs/stacks#3386. The scheduler's pause file and lock directory were
// `process.cwd()/storage/framework/...`, so a process started anywhere but
// the project root kept its own: a pause written there was not the one the
// scheduler read, and the lock it took did not exclude the other's. And
// setEnabled() created `<cwd>/storage/framework/runtime` even when the state
// file lives elsewhere - which, run from a framework package, is the stray
// tree that made the package resolve as a project of its own.
test('the pause file and locks live in the project, whatever the working directory', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-scheduler-state-'))
  const project = join(fixture, 'app')
  const pkg = join(project, 'storage/framework/core/scheduler')
  const elsewhere = join(fixture, 'elsewhere')
  mkdirSync(pkg, { recursive: true })
  mkdirSync(elsewhere, { recursive: true })
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'app' }))
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@stacksjs/scheduler' }))

  try {
    const result = Bun.spawnSync([process.execPath, '-e', `
      import assert from 'node:assert/strict'
      import { existsSync, realpathSync } from 'node:fs'
      import { join } from 'node:path'
      const [project, pkg, elsewhere] = process.argv.slice(1).map(realpathSync)
      process.chdir(pkg)
      const { Schedule } = await import(${JSON.stringify(join(import.meta.dir, '../src/schedule.ts'))})
      const internals = Schedule
      assert.equal(internals.stateFile, join(project, 'storage/framework/runtime/scheduler-state.json'))
      assert.equal(internals.lockDir, join(project, 'storage/framework/locks'))

      internals.stateFile = join(elsewhere, 'runtime/scheduler-state.json')
      Schedule.setEnabled('nightly-report', false)
      assert.equal(Schedule.isEnabled('nightly-report'), false)
      assert.equal(existsSync(internals.stateFile), true)
      assert.equal(existsSync(join(pkg, 'storage')), false, 'setEnabled wrote into the working directory')
      console.log('scheduler state location OK')
      process.exit(0)
    `, project, pkg, elsewhere], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, APP_ENV: 'test' } })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stdout.toString()).toContain('scheduler state location OK')
  }
  finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}, 30_000)
