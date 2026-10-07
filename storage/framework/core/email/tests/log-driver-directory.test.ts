import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Where the log driver writes, from a project it does not live in.
 *
 * It counted five directories up from its own file, which is `storage/` in the
 * framework's checkout and the app's root from an installed package, so in an
 * app the captures went to `<app>/logs/mail` while the dashboard's
 * captured-mail pages read `<app>/storage/logs/mail` and listed nothing.
 * Here the driver's file is in this repository and the project is a temporary
 * directory, which is exactly that split.
 */
describe('the log mail driver', () => {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-log-mail-')))
  mkdirSync(join(project, 'storage', 'framework'), { recursive: true })
  writeFileSync(join(project, 'package.json'), '{"name":"log-mail-fixture"}\n')
  afterAll(() => rmSync(project, { recursive: true, force: true }))

  function send(env: Record<string, string | undefined> = {}): { success: boolean, directory: string } {
    const merged: Record<string, string | undefined> = { ...process.env, ...env }
    if (!('LOG_MAIL_DIR' in env))
      delete merged.LOG_MAIL_DIR
    const result = Bun.spawnSync([process.execPath, join(import.meta.dir, 'fixtures', 'send-through-log-driver.ts')], { cwd: project, env: merged, stdout: 'pipe', stderr: 'pipe' })
    const line = result.stdout.toString().split('\n').find(candidate => candidate.startsWith('{"success"'))
    if (!line)
      throw new Error(`no result (exit ${result.exitCode})\n${result.stdout}\n${result.stderr}`)
    return JSON.parse(line)
  }

  it('writes into the running project\'s storage/logs/mail, where the dashboard reads', () => {
    const { success, directory } = send()

    expect(success).toBe(true)
    expect(directory).toBe(join(project, 'storage', 'logs', 'mail'))
    const files = readdirSync(directory)
    expect(files).toHaveLength(1)
    expect(files[0]).toEndWith('-Captured-here.html')
    expect(readFileSync(join(directory, files[0]!), 'utf8')).toContain('hello')
    // Not beside the project root, where the five-levels-up count put it from a package.
    expect(existsSync(join(project, 'logs'))).toBe(false)
  }, 60_000)

  it('writes where LOG_MAIL_DIR says, when it is set', () => {
    const elsewhere = join(project, 'custom-mail')
    expect(send({ LOG_MAIL_DIR: elsewhere }).directory).toBe(elsewhere)
    expect(readdirSync(elsewhere)).toHaveLength(1)
  }, 60_000)
})
