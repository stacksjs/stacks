// The "create the missing database?" preflight.
//
// These cover the two decisions that gate a side effect on someone's server:
// whether we are allowed to raise a blocking question at all, and what the
// standing policy says. Both are pure and env-driven, so they are exercised
// here without a database or a terminal.
//
// The interactive paths (accept, decline, bare Enter, timeout) are verified
// end to end against a live Postgres through a pty, which no unit test can
// meaningfully simulate.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import process from 'node:process'
import { canPromptInteractively, resolveCreatePolicy } from '../src/database-preflight'

const CI_VARS = ['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'RUN_ID']

let saved: Record<string, string | undefined>
let savedStdinTTY: boolean | undefined
let savedStdoutTTY: boolean | undefined

beforeEach(() => {
  saved = {}
  for (const key of [...CI_VARS, 'DB_CREATE_DATABASE'])
    saved[key] = process.env[key]

  for (const key of CI_VARS)
    delete process.env[key]
  delete process.env.DB_CREATE_DATABASE

  savedStdinTTY = process.stdin.isTTY
  savedStdoutTTY = process.stdout.isTTY
})

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }

  Object.defineProperty(process.stdin, 'isTTY', { value: savedStdinTTY, configurable: true })
  Object.defineProperty(process.stdout, 'isTTY', { value: savedStdoutTTY, configurable: true })
})

function setTTY(stdin: boolean, stdout: boolean) {
  Object.defineProperty(process.stdin, 'isTTY', { value: stdin, configurable: true })
  Object.defineProperty(process.stdout, 'isTTY', { value: stdout, configurable: true })
}

describe('canPromptInteractively', () => {
  it('allows a prompt when both streams are a terminal and nothing says CI', () => {
    setTTY(true, true)
    expect(canPromptInteractively()).toBe(true)
  })

  it.each(CI_VARS)('refuses to prompt when %s is set, even with a full TTY', (key) => {
    // CI runners can and do allocate a pty, so the TTY check alone is not
    // enough. A blocking question there hangs the job until it is killed.
    setTTY(true, true)
    process.env[key] = '1'
    expect(canPromptInteractively()).toBe(false)
  })

  it('refuses when stdin is not a terminal, even if stdout is', () => {
    // `buddy migrate < /dev/null` keeps a terminal on stdout while stdin is
    // already at EOF, so checking stdout alone would ask a question that can
    // never be answered.
    setTTY(false, true)
    expect(canPromptInteractively()).toBe(false)
  })

  it('refuses when stdout is piped', () => {
    // `buddy migrate | tee log` — the question would not be visible.
    setTTY(true, false)
    expect(canPromptInteractively()).toBe(false)
  })

  it('is evaluated per call, not frozen at import', () => {
    // @stacksjs/env computes isCI and hasTTY once at module load, so anything
    // that sets CI afterwards (a wrapper script, a config file evaluated
    // during CLI boot, a test harness) would get no protection from them.
    setTTY(true, true)
    expect(canPromptInteractively()).toBe(true)

    process.env.CI = 'true'
    expect(canPromptInteractively()).toBe(false)

    delete process.env.CI
    expect(canPromptInteractively()).toBe(true)
  })
})

describe('resolveCreatePolicy', () => {
  it('defaults to asking', () => {
    expect(resolveCreatePolicy()).toBe('prompt')
  })

  it.each(['always', 'true', '1', 'ALWAYS'])('treats %s as always', (value) => {
    process.env.DB_CREATE_DATABASE = value
    expect(resolveCreatePolicy()).toBe('always')
  })

  it.each(['never', 'false', '0', 'Never'])('treats %s as never', (value) => {
    process.env.DB_CREATE_DATABASE = value
    expect(resolveCreatePolicy()).toBe('never')
  })

  it('falls back to asking for anything it does not recognise', () => {
    // Deliberately not "always": an unreadable policy must never be taken as
    // permission to provision.
    process.env.DB_CREATE_DATABASE = 'maybe'
    expect(resolveCreatePolicy()).toBe('prompt')
  })
})
