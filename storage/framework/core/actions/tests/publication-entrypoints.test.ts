import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

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
    ], { cwd: root, env: { PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code).not.toBe(0)
    expect(`${stdout}\n${stderr}`).toContain('publication:check failed with exit code 9')
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)
