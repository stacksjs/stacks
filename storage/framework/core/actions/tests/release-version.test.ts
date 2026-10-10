import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('consumer release dry runs use Bumpx prerelease, build and stable promotion without writes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-release-version-'))
  const manifest = join(directory, 'package.json')
  const config = join(directory, 'bunfig.toml')
  const preload = join(directory, 'preload.ts')
  writeFileSync(preload, 'export {}\n')
  writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
  const run = async (args: string[]) => {
    const child = Bun.spawn(args, { cwd: directory, env: { ...process.env, APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 8000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, stdout, stderr }
    }
    finally { clearTimeout(timeout); child.kill() }
  }
  try {
    writeFileSync(manifest, JSON.stringify({ name: 'release-check', version: '1.0.0' }))
    for (const args of [['git', 'init', '-q'], ['git', 'add', 'package.json'], ['git', '-c', 'user.name=Release Test', '-c', 'user.email=release@test.local', 'commit', '-qm', 'chore: start']]) {
      const result = await run(args)
      expect(result.code, result.stderr).toBe(0)
    }
    for (const [current, bump, expected] of [
      ['1.0.0', 'pre', '1.0.0-beta.0'],
      ['1.0.0-beta.2', 'prerelease', '1.0.0-beta.3'],
      ['1.0.0-beta.2', 'patch', '1.0.0'],
      ['1.0.0-rc.2', 'release', '1.0.0'],
      ['1.0.0+build.11', 'build', '1.0.0+build.12'],
      ['1.0.0', 'v2.0.0', '2.0.0'],
    ]) {
      const original = JSON.stringify({ name: 'release-check', version: current })
      writeFileSync(manifest, original)
      const result = await run([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, '../src/bump.ts'), '--bump', bump!, '--preid', 'beta', '--dry-run'])
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(result.stdout).toContain(expected!)
      expect(readFileSync(manifest, 'utf8')).toBe(original)
    }
    const rejected = await run([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, '../src/bump.ts'), '--bump', 'nonsense', '--dry-run'])
    expect(rejected.code).not.toBe(0)
    expect(rejected.stderr).toContain('Invalid --bump')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 30000)
