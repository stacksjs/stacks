import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projects: string[] = []
afterEach(() => {
  for (const project of projects.splice(0))
    rmSync(project, { recursive: true, force: true })
})

test.each([
  { named: false, failing: false },
  { named: true, failing: false },
  { named: true, failing: true },
])('test action isolates files and preserves failures (%j)', async ({ named, failing }) => {
  const project = mkdtempSync(join(tmpdir(), 'stacks-file-isolation-'))
  projects.push(project)
  mkdirSync(join(project, 'tests/unit'), { recursive: true })
  writeFileSync(join(project, 'bunfig.toml'), '[test]\npreload = []\n')
  const files = ['tests/unit/first.test.ts', 'tests/unit/second.test.ts']
  for (const file of files) {
    writeFileSync(join(project, file), `
import { expect, test } from 'bun:test'
test('starts with its own global', () => {
  expect(globalThis.__stacks_test_file_marker).toBeUndefined()
  globalThis.__stacks_test_file_marker = true
})
`)
  }
  if (failing) {
    files.push('tests/unit/failure.test.ts')
    writeFileSync(join(project, files.at(-1)!), `import { test } from 'bun:test'\ntest('intentional failure', () => { throw new Error('fixture failure') })\n`)
  }
  const runner = fileURLToPath(new URL('../src/test/runner.ts', import.meta.url))
  writeFileSync(join(project, 'driver.ts'), `
import { runTestSuites } from ${JSON.stringify(runner)}
await runTestSuites(['unit'], 5000, ${JSON.stringify(named ? files : [])})
`)
  const child = Bun.spawn([process.execPath, '--no-env-file', `--config=${join(project, 'bunfig.toml')}`, join(project, 'driver.ts')], {
    cwd: project,
    env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`, APP_ENV: 'test', NODE_ENV: 'test' },
    stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect({ exitCode, output: stdout + stderr }).toEqual({ exitCode: failing ? 1 : 0, output: expect.stringContaining('2 pass') })
  expect(stdout + stderr).toContain(failing ? '1 fail' : '0 fail')
}, 15000)
