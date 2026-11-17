// Running the files in batches, and why the number is what it is.
//
// `--isolate` keeps a module graph per file for as long as the process lives,
// so one process holding every file is a memory curve that ends where the
// machine does. The symptom is not a failing test: the kernel picks a victim
// near the end of the suite, and when it picks the CI agent the job dies with
// nothing to say why. Batching bounds the peak by letting a process exit.

import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { intoTestBatches, testBatchFiles } from '../src/test/runner'

const projects: string[] = []
afterEach(() => {
  for (const project of projects.splice(0))
    rmSync(project, { recursive: true, force: true })
})

describe('how many files a process takes', () => {
  test('a hundred by default, which is a couple of gigabytes of isolation', () => {
    expect(testBatchFiles({})).toBe(100)
    expect(testBatchFiles({ BUDDY_TEST_BATCH_FILES: '   ' })).toBe(100)
  })

  test('or whatever the environment asks for', () => {
    expect(testBatchFiles({ BUDDY_TEST_BATCH_FILES: '25' })).toBe(25)
    expect(testBatchFiles({ BUDDY_TEST_BATCH_FILES: ' 7 ' })).toBe(7)
  })

  test('and off means one process again, which is how you tell the two apart', () => {
    // A suite that fails only when batched is a different bug from a suite
    // that fails anyway, and this is the switch that separates them.
    expect(testBatchFiles({ BUDDY_TEST_BATCH_FILES: 'off' })).toBeNull()
    expect(testBatchFiles({ BUDDY_TEST_BATCH_FILES: '0' })).toBeNull()
  })

  test('a value that is not a count is refused rather than rounded', () => {
    // `1e3` is absent on purpose: it is 1000, unambiguously, and refusing a
    // number for its spelling would be pedantry rather than validation.
    for (const named of ['-5', '1.5', 'lots', '100 files']) {
      expect(() => testBatchFiles({ BUDDY_TEST_BATCH_FILES: named }))
        .toThrow('must be a whole number of files')
    }
  })
})

describe('splitting the files up', () => {
  test('keeps the order it was given, because a suite order is a suite order', () => {
    expect(intoTestBatches(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  test('divides evenly without leaving an empty batch behind', () => {
    expect(intoTestBatches(['a', 'b', 'c', 'd'], 2)).toEqual([['a', 'b'], ['c', 'd']])
  })

  test('and asks for one process when the batch is bigger than the suite', () => {
    expect(intoTestBatches(['a', 'b'], 100)).toEqual([['a', 'b']])
    expect(intoTestBatches([], 100)).toEqual([])
  })
})

/*
 * Through the real runner, because the rule being right is worth nothing if
 * the spawn loop does not act on it.
 */
describe('a batched run', () => {
  const drive = async (files: string[], batch: string, failing: boolean) => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-test-batching-'))
    projects.push(project)
    mkdirSync(join(project, 'tests/unit'), { recursive: true })
    writeFileSync(join(project, 'bunfig.toml'), '[test]\npreload = []\n')
    for (const file of files) {
      writeFileSync(join(project, file), `
import { expect, test } from 'bun:test'
test('runs with its own global', () => {
  expect(globalThis.__stacks_batch_marker).toBeUndefined()
  globalThis.__stacks_batch_marker = true
})
`)
    }
    if (failing) {
      files = [...files, 'tests/unit/failure.test.ts']
      writeFileSync(join(project, files.at(-1)!), `import { test } from 'bun:test'\ntest('intentional failure', () => { throw new Error('fixture failure') })\n`)
    }
    const runner = fileURLToPath(new URL('../src/test/runner.ts', import.meta.url))
    writeFileSync(join(project, 'driver.ts'), `
import { runTestSuites } from ${JSON.stringify(runner)}
await runTestSuites(['unit'], 5000, ${JSON.stringify(files)})
`)
    const child = Bun.spawn([process.execPath, '--no-env-file', `--config=${join(project, 'bunfig.toml')}`, join(project, 'driver.ts')], {
      cwd: project,
      env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`, APP_ENV: 'test', NODE_ENV: 'test', BUDDY_TEST_BATCH_FILES: batch },
      stdout: 'pipe', stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { exitCode, output: stdout + stderr }
  }

  const four = ['tests/unit/a.test.ts', 'tests/unit/b.test.ts', 'tests/unit/c.test.ts', 'tests/unit/d.test.ts']

  test('runs every file, in as many processes as the batch size asks for', async () => {
    const { exitCode, output } = await drive(four, '2', false)

    expect(exitCode).toBe(0)
    expect(output).toContain('Tests 1/2: 2 file(s)')
    expect(output).toContain('Tests 2/2: 2 file(s)')
    // Two processes, each reporting its own two files. Four files ran.
    expect(output.match(/2 pass/g)?.length).toBe(2)
  }, 30_000)

  test('and says nothing about batches when there is only one', async () => {
    const { exitCode, output } = await drive(four, '100', false)

    expect(exitCode).toBe(0)
    expect(output).not.toContain('Tests 1/1')
    expect(output).toContain('4 pass')
  }, 30_000)

  test('a failure in one batch fails the run', async () => {
    const { exitCode, output } = await drive(four, '2', true)

    expect(exitCode).toBe(1)
    expect(output).toContain('1 fail')
  }, 30_000)

  test('and does not stop the batches after it, because a suite reports all of its failures', async () => {
    // The failing file is last, so this pins the opposite: the batches before
    // it all ran. A fail-fast loop would be a behaviour change dressed up as a
    // memory fix.
    const { exitCode, output } = await drive(four, '1', true)

    expect(exitCode).toBe(1)
    expect(output).toContain('Tests 5/5: 1 file(s)')
    expect(output.match(/1 pass/g)?.length).toBe(4)
  }, 40_000)

  test('and one process again when batching is off', async () => {
    const { exitCode, output } = await drive(four, 'off', false)

    expect(exitCode).toBe(0)
    expect(output).not.toContain('Tests 1/')
    expect(output).toContain('4 pass')
  }, 30_000)
})
