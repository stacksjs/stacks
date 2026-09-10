import process from 'node:process'
import { afterEach, describe, expect, it } from 'bun:test'
import { promptsAreInteractive } from '../src/prompts'

/**
 * `--no-interaction` is a process-wide buddy option printed in every command's
 * help, and nothing read it (stacksjs/stacks#853).
 *
 * Closed stdin already resolves a prompt to its default rather than hanging,
 * so this was never the CI hang it looks like - but a flag that promises not
 * to prompt and then prompts is still a promise broken, and a runner whose
 * stdin is an open pipe with no data has nothing else to save it.
 */

const originalArgv = process.argv
const originalCI = process.env.CI

afterEach(() => {
  process.argv = originalArgv
  if (originalCI === undefined)
    delete process.env.CI
  else
    process.env.CI = originalCI
})

function withArgv(...args: string[]): void {
  process.argv = ['bun', 'buddy', ...args]
}

describe('promptsAreInteractive', () => {
  it('is false when --no-interaction is passed', () => {
    delete process.env.CI
    withArgv('deploy', '--no-interaction')
    expect(promptsAreInteractive()).toBeFalse()
  })

  it('is false under CI even when a TTY was allocated', () => {
    // Some providers allocate a TTY, so `isTTY` alone is not the answer.
    process.env.CI = 'true'
    withArgv('deploy')
    expect(promptsAreInteractive()).toBeFalse()
  })

  it('is false without a TTY on both ends', () => {
    delete process.env.CI
    withArgv('deploy')
    // The suite itself runs without a TTY, which is the case being asserted.
    expect(promptsAreInteractive()).toBe(Boolean(process.stdin.isTTY && process.stdout.isTTY))
  })

  it('does not confuse --no-interaction with a similarly named flag', () => {
    delete process.env.CI
    withArgv('deploy', '--no-interactive')
    // Exact match only: `--no-interactive` is not the registered option, and
    // treating it as one would silence prompts for a typo.
    expect(promptsAreInteractive()).toBe(Boolean(process.stdin.isTTY && process.stdout.isTTY))
  })
})
