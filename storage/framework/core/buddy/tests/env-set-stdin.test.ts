import { expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getEnv } from '../../env/src/cli'

async function run(args: string[], input = '', failure?: 'read' | 'tty') {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const cwd = mkdtempSync(join(tmpdir(), 'buddy-env-stdin-'))
  try {
    const runner = join(cwd, 'buddy.ts')
    writeFileSync(runner, `import { cli } from ${JSON.stringify(join(checkout, 'storage/framework/core/cli/src/index.ts'))}
import { env } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/env.ts'))}
if (process.env.FIXTURE_FAILURE === 'read') Object.defineProperty(Bun, 'stdin', { value: { text: async () => { throw new Error('fixture-input-must-stay-private') } } })
if (process.env.FIXTURE_FAILURE === 'tty') Object.defineProperty(process.stdin, 'isTTY', { value: true })
const buddy = cli('buddy')
env(buddy)
await buddy.parse()
`)
    const child = Bun.spawn([
      process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
      runner, 'env:set', ...args, '--file', '.env.production',
    ], {
      cwd,
      env: { PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test', FIXTURE_FAILURE: failure },
      stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    })
    child.stdin.write(input)
    child.stdin.end()
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return {
      code, transcript: `${stdout}\n${stderr}`,
      value: existsSync(join(cwd, '.env.production')) ? getEnv('FIXTURE_SECRET', { cwd, file: '.env.production' }).output : undefined,
      createdKeys: existsSync(join(cwd, '.env.keys')),
    }
  }
  finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

test('env:set encrypts standard input without printing it or putting it in argv', async () => {
  const secret = '-----BEGIN FIXTURE-----\nprivate input with spaces\n-----END FIXTURE-----\n'
  const result = await run(['FIXTURE_SECRET', '--stdin', '--verbose'], secret)
  expect(result.code, result.transcript).toBe(0)
  expect(result.value).toBe(secret)
  expect(result.transcript).not.toContain('private input with spaces')
  expect(result.transcript).toContain('with encryption (.env.production)')
})

test.each(['', '  padded input\r\n'])('env:set retains exact empty and whitespace input (%j)', async (input) => {
  const result = await run(['FIXTURE_SECRET', '--stdin'], input)
  expect(result.code, result.transcript).toBe(0)
  expect(result.value).toBe(input)
  expect(result.createdKeys).toBe(true)
})

test.each(['argument-must-stay-private', ''])('env:set refuses a positional value together with --stdin (%j)', async (argument) => {
  const result = await run(['FIXTURE_SECRET', argument, '--stdin'], 'piped-input-must-stay-private')
  expect(result.code).not.toBe(0)
  expect(result.transcript).toContain('Choose a value argument or --stdin, not both.')
  expect(result.transcript).not.toContain('argument-must-stay-private')
  expect(result.transcript).not.toContain('piped-input-must-stay-private')
  expect(result.createdKeys).toBe(false)
})

test.each(['read', 'tty'] as const)('env:set refuses unreadable or interactive input before writing (%s)', async (failure) => {
  const result = await run(['FIXTURE_SECRET', '--stdin'], 'piped-input-must-stay-private', failure)
  expect(result.code).not.toBe(0)
  expect(result.transcript).toContain('no value was written')
  expect(result.transcript).not.toContain('fixture-input-must-stay-private')
  expect(result.transcript).not.toContain('piped-input-must-stay-private')
  expect(result.createdKeys).toBe(false)
})

test('env:set still accepts an explicit positional value and reports missing values accurately', async () => {
  const positional = await run(['FIXTURE_SECRET', 'positional-fixture'])
  expect(positional.code, positional.transcript).toBe(0)
  expect(positional.value).toBe('positional-fixture')
  const missing = await run(['FIXTURE_SECRET'])
  expect(missing.code).not.toBe(0)
  expect(missing.transcript).toContain('No value given for FIXTURE_SECRET')
  expect(missing.createdKeys).toBe(false)
  const noKey = await run(['--stdin'], 'piped-input-must-stay-private')
  expect(noKey.code).not.toBe(0)
  expect(noKey.transcript).toContain('A key is required')
  expect(noKey.transcript).not.toContain('piped-input-must-stay-private')
  expect(noKey.createdKeys).toBe(false)
})
