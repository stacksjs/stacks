/**
 * `runInBackground()` runs the task, by name, in a process of its own.
 *
 * It used to evaluate the task's source with `bun -e`, which works only for a
 * function that refers to nothing outside itself. Every task the framework
 * builds does - `schedule.job(name)` closes over `name` and `runJob`,
 * `schedule.command(cmd)` over `cmd` - so each one died in the child on a
 * ReferenceError, and the parent logged an exit code.
 *
 * The child is now `buddy schedule:run-one <name> --in-process`. A stub `buddy`
 * in a temporary project records how it was started; `runNow(name, {
 * inProcess: true })` is what that command does once it is running.
 */

import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { log } from '@stacksjs/cli'
import { Schedule } from '../src/schedule'

const originalCwd = process.cwd()
let project = ''
let counter = 0

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'stacks-scheduler-background-'))
  // Records its arguments and working directory, prints a line, and exits.
  writeFileSync(join(project, 'buddy'), [
    '#!/bin/sh',
    'printf "%s\\n" "$@" > "$PWD/spawned-args"',
    'pwd > "$PWD/spawned-cwd"',
    'echo "child output"',
    '',
  ].join('\n'))
  chmodSync(join(project, 'buddy'), 0o755)
})

afterEach(async () => {
  process.chdir(originalCwd)
  await Schedule.gracefulShutdown()
})

afterAll(() => {
  rmSync(project, { recursive: true, force: true })
})

/** Wait for the stub to have written `file`. */
async function waitFor(file: string): Promise<string> {
  for (let i = 0; i < 200; i++) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf8')
      if (content.length > 0)
        return content
    }
    await Bun.sleep(10)
  }
  throw new Error(`${file} never appeared`)
}

function freshName(prefix: string): string {
  return `${prefix}-${process.pid}-${++counter}`
}

describe('runInBackground()', () => {
  it('starts `buddy schedule:run-one <name> --in-process` in the project', async () => {
    process.chdir(project)
    for (const file of ['spawned-args', 'spawned-cwd']) rmSync(join(project, file), { force: true })
    let ranHere = 0
    const name = freshName('report sync')
    new Schedule(() => { ranHere++ }).everyMinute().runInBackground().withName(name)
    await Promise.resolve()

    await Schedule.runNow(name)

    expect((await waitFor(join(project, 'spawned-args'))).trim().split('\n')).toEqual(['schedule:run-one', name, '--in-process'])
    expect((await waitFor(join(project, 'spawned-cwd'))).trim()).toBe(realpathSync(project))
    expect(ranHere).toBe(0)
  })

  it('works for a task that closes over its surroundings, which is every framework task', async () => {
    process.chdir(project)
    rmSync(join(project, 'spawned-args'), { force: true })
    const name = freshName('closure')
    const outer = { value: 'from the enclosing scope' }
    const seen: string[] = []
    new Schedule(() => { seen.push(outer.value) }).everyMinute().runInBackground().withName(name)
    await Promise.resolve()

    await Schedule.runNow(name)
    expect((await waitFor(join(project, 'spawned-args'))).trim().split('\n')[1]).toBe(name)

    // And the background process, running it in-process, has it all in scope.
    await Schedule.runNow(name, { inProcess: true })
    expect(seen).toEqual(['from the enclosing scope'])
  })

  it('captures the background process output in sendOutputTo()', async () => {
    process.chdir(project)
    const output = join(project, 'task.log')
    rmSync(output, { force: true })
    const name = freshName('captured')
    new Schedule(() => {}).everyMinute().runInBackground().sendOutputTo(output).withName(name)
    await Promise.resolve()

    await Schedule.runNow(name)

    expect(await waitFor(output)).toContain('child output')
  })

  it('takes the overlap lock in the background process, not in the scheduler', async () => {
    process.chdir(project)
    const locks = mkdtempSync(join(tmpdir(), 'stacks-scheduler-background-locks-'))
    const previous = (Schedule as unknown as { lockDir: string }).lockDir
    ;(Schedule as unknown as { lockDir: string }).lockDir = locks
    try {
      const name = freshName('locked')
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      let runs = 0
      new Schedule(async () => {
        runs++
        await gate
      }).everyMinute().runInBackground().withoutOverlapping().withName(name)
      await Promise.resolve()

      // The scheduler side only spawns, so it never holds the lock...
      await Schedule.runNow(name)
      expect(Schedule.listLocks()).toEqual([])

      // ...and the in-process run is the one that takes it.
      const first = Schedule.runNow(name, { inProcess: true })
      await Bun.sleep(20)
      expect(Schedule.listLocks()).toContain(name)
      await Schedule.runNow(name, { inProcess: true })
      expect(runs).toBe(1)

      release()
      await first
      expect(Schedule.listLocks()).toEqual([])
    }
    finally {
      ;(Schedule as unknown as { lockDir: string }).lockDir = previous
      rmSync(locks, { recursive: true, force: true })
    }
  })

  it('refuses a task with no name, which the background process could not find', async () => {
    const errors = spyOn(log, 'error').mockImplementation(() => {})
    try {
      new Schedule(() => {}).everyMinute().runInBackground()
      await Promise.resolve()
      const messages = errors.mock.calls.map(([message]) => String(message))
      expect(messages.some(message => message.includes('runInBackground() needs a named task'))).toBe(true)
    }
    finally {
      errors.mockRestore()
    }
  })
})
