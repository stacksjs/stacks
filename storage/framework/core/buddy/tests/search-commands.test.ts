import { expect, test } from 'bun:test'
import { join } from 'node:path'

function run(...args: string[]) {
  const result = Bun.spawnSync([process.execPath, join(import.meta.dir, 'fixtures/search-commands.ts'), ...args], {
    cwd: join(import.meta.dir, '../../../../..'),
    env: { ...process.env, APP_ENV: 'test', NODE_ENV: 'test' },
    stdout: 'pipe', stderr: 'pipe', timeout: 20000,
  })
  const output = result.stdout.toString() + result.stderr.toString()
  const line = result.stdout.toString().split('\n').find(value => value.startsWith('{"call":'))
  return { code: result.exitCode, output, call: line ? JSON.parse(line) : undefined }
}

for (const command of ['search-engine:update', 'search-engine:settings']) {
  test(`${command} accepts an omitted model through the actual CLI parser`, () => {
    const result = run(command)
    expect(result.code, result.output).toBe(0)
    expect(result.call?.call).toBe('runAction')
    expect(result.call?.options.model).toBeUndefined()
  }, 25000)

  test(`${command} forwards an explicit model and refuses a valueless flag`, () => {
    const selected = run(command, '--model', 'User')
    expect(selected.code, selected.output).toBe(0)
    expect(selected.call?.options.model).toBe('User')
    const missing = run(command, '--model')
    expect(missing.code).not.toBe(0)
    expect(missing.call).toBeUndefined()
    expect(missing.output).toContain('requires a value')
  }, 45000)
}
