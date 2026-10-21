import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from './helpers/publication-environment'

test('isolated publication processes retain Windows runtime paths without cloud credentials', () => {
  const env = publicationEnvironment({
    Path: 'C:\\Windows\\System32', SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe', TEMP: 'C:\\Temp', TMP: 'C:\\Temp',
    PATHEXT: '.COM;.EXE;.BAT;.CMD', PSModulePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules',
    APP_ENV: 'production', NODE_ENV: 'production', AWS_ACCESS_KEY_ID: 'fixture-cloud-secret',
    GITHUB_TOKEN: 'fixture-publish-secret', DOTENV_PRIVATE_KEY_PRODUCTION: 'fixture-decryption-secret',
  })
  expect(env.Path).toBe('C:\\Windows\\System32')
  expect(env.SystemRoot).toBe('C:\\Windows')
  expect(env.ComSpec).toBe('C:\\Windows\\System32\\cmd.exe')
  expect(env.TEMP).toBe('C:\\Temp')
  expect(env.TMP).toBe('C:\\Temp')
  expect(env.PATHEXT).toBe('.COM;.EXE;.BAT;.CMD')
  expect(env.PSModulePath).toContain('WindowsPowerShell')
  expect(env.APP_ENV).toBe('test')
  expect(env.NODE_ENV).toBe('test')
  expect(env.AWS_ACCESS_KEY_ID).toBeUndefined()
  expect(env.GITHUB_TOKEN).toBeUndefined()
  expect(env.DOTENV_PRIVATE_KEY_PRODUCTION).toBeUndefined()
})

test.each(['release.ts', 'deploy/index.ts'])('the direct %s action refuses policy failure before publication work', async (action) => {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'stacks-publication-entry-'))
  const manifest = JSON.stringify({ name: 'private-policy-fixture', private: true, version: '1.0.0', scripts: { 'publication:check': 'bun -e "process.exit(9)"' } })
  try {
    writeFileSync(join(root, 'package.json'), manifest)
    const runner = join(root, 'action.ts')
    writeFileSync(runner, `import { projectPath } from ${JSON.stringify(join(checkout, 'storage/framework/core/path/src/index.ts'))}
if (projectPath() !== process.cwd()) throw new Error('Fixture project root does not match its isolated directory')
await import(${JSON.stringify(join(checkout, 'storage/framework/core/actions/src', action))})
`)
    const child = Bun.spawn([
      process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'), runner, '--bump', 'patch',
    ], { cwd: root, env: publicationEnvironment(), stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code).not.toBe(0)
    expect(`${stdout}\n${stderr}`).toContain('publication:check failed with exit code 9')
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)
