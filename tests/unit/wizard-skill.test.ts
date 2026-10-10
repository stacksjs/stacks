import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const template = readFileSync(resolve('storage/framework/defaults/ai/skills/stacks-wizard/scripts/template.sh'), 'utf8')
let scratch: string
let library: string

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'stacks-wizard-test-'))
  library = join(scratch, 'library.sh')
  writeFileSync(library, template.slice(0, template.indexOf('# STAGES:')))
})

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('wizard environment helper', () => {
  test('round-trips quoted values and creates private environment files', () => {
    const environment = join(scratch, '.env')
    const value = 'fixture $dollar #hash "double" \'single\' `literal`'
    const result = Bun.spawnSync(['bash', '-c', 'source "$1"; ENV_FILE="$2"; write_env FIXTURE_VALUE "$3" >/dev/null; _existing FIXTURE_VALUE', 'bash', library, environment, value])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toBe(value)
    expect(lstatSync(environment).mode & 0o777).toBe(0o600)
  })

  test('updates through a symlink without replacing it or unrelated values', () => {
    const realEnvironment = join(scratch, 'real.env')
    const environment = join(scratch, '.env')
    writeFileSync(realEnvironment, 'UNRELATED=keep\nFIXTURE_VALUE=old\n', { mode: 0o640 })
    symlinkSync(realEnvironment, environment)
    const result = Bun.spawnSync(['bash', '-c', 'source "$1"; ENV_FILE="$2"; write_env FIXTURE_VALUE new >/dev/null; write_env FIXTURE_VALUE final >/dev/null; _existing FIXTURE_VALUE', 'bash', library, environment])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toBe('final')
    expect(lstatSync(environment).isSymbolicLink()).toBe(true)
    expect(lstatSync(realEnvironment).mode & 0o777).toBe(0o640)
    expect(readFileSync(realEnvironment, 'utf8')).toBe('UNRELATED=keep\nFIXTURE_VALUE=\'final\'\n')
  })

  test('rejects EOF without performing sample setup or accepting an empty secret', () => {
    mkdirSync(join(scratch, 'env'))
    for (const helper of ['ask', 'ask_secret']) {
      const result = Bun.spawnSync(['bash', '-c', `source "$1"; ENV_FILE="$2"; ${helper} FIXTURE_VALUE Prompt`, 'bash', library, join(scratch, 'env/.env')], { stdin: new Uint8Array() })
      expect(result.exitCode).not.toBe(0)
    }
  })
})
