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
}, 60_000)

test('Buddy stops before writes for existing release refs and preserves its commit when a push races', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-release-atomic-'))
  const app = join(directory, 'app')
  const remote = join(directory, 'remote.git')
  const other = join(directory, 'other')
  const shared = join(directory, 'shared')
  const run = async (args: string[], cwd = directory) => {
    const child = Bun.spawn(args, { cwd, env: { ...process.env, APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 10000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, stdout: stdout.trim(), stderr }
    }
    finally { clearTimeout(timeout); child.kill() }
  }
  const git = async (args: string[], cwd = directory) => {
    const result = await run(['git', ...args], cwd)
    expect(result.code, result.stderr).toBe(0)
    return result.stdout
  }
  try {
    await git(['init', '--bare', '-q', remote])
    await git(['init', '-q', '-b', 'main', app])
    await git(['config', 'user.name', 'Release Test'], app)
    await git(['config', 'user.email', 'release@test.local'], app)
    const manifest = join(app, 'package.json')
    const initial = JSON.stringify({ name: 'atomic-release-check', version: '1.0.0' })
    writeFileSync(manifest, initial)
    writeFileSync(join(app, 'bunfig.toml'), 'preload = []\n')
    await git(['add', 'package.json', 'bunfig.toml'], app)
    await git(['commit', '-qm', 'chore: start'], app)
    await git(['remote', 'add', 'origin', remote], app)
    await git(['push', '-qu', 'origin', 'main'], app)
    const before = await git(['rev-parse', 'refs/heads/main'], remote)
    const bump = () => run([process.execPath, `--config=${join(app, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, '../src/bump.ts'), '--bump', 'patch'], app)

    await git(['clone', '-q', '-b', 'main', remote, other])
    await git(['tag', 'v1.0.1'], other)
    await git(['push', '-q', 'origin', 'refs/tags/v1.0.1'], other)
    const conflict = await bump()
    expect(conflict.code).not.toBe(0)
    expect(conflict.stderr).toContain(`refs/tags/v1.0.1 already exists on origin at ${before}`)
    expect(readFileSync(manifest, 'utf8')).toBe(initial)
    expect(await git(['rev-parse', 'HEAD'], app)).toBe(before)
    expect(await git(['status', '--porcelain'], app)).toBe('')
    expect(await git(['rev-parse', 'refs/tags/v1.0.1'], remote)).toBe(before)

    await git(['tag', '-d', 'v1.0.1'], remote)
    await git(['-c', 'user.name=Release Test', '-c', 'user.email=release@test.local', 'commit', '--allow-empty', '-qm', 'advance main'], other)
    await git(['push', '-q', 'origin', 'main'], other)
    const advanced = await git(['rev-parse', 'HEAD'], other)
    const stale = await bump()
    expect(stale.code).not.toBe(0)
    expect(stale.stderr).toContain(`origin/refs/heads/main is at ${advanced}`)
    expect(await git(['status', '--porcelain'], app)).toBe('')
    expect(await git(['rev-parse', 'HEAD'], app)).toBe(before)
    await git(['update-ref', 'refs/heads/main', before, advanced], remote)

    await git(['worktree', 'add', '-q', '--detach', shared], app)
    await git(['tag', 'v1.0.1'], shared)
    const sharedTag = await bump()
    expect(sharedTag.code).not.toBe(0)
    expect(sharedTag.stderr).toContain(`refs/tags/v1.0.1 already exists locally at ${before}`)
    expect(await git(['status', '--porcelain'], app)).toBe('')
    expect(await git(['rev-parse', 'HEAD'], app)).toBe(before)
    await git(['tag', '-d', 'v1.0.1'], shared)

    writeFileSync(join(app, '.git/hooks/pre-push'), '#!/bin/sh\ngit --git-dir="$2" tag v1.0.1 "$(git --git-dir="$2" rev-parse refs/heads/main)"\n', { mode: 0o755 })
    const race = await bump()
    expect(race.code).not.toBe(0)
    expect(race.stderr).toContain('Prepared release commit preserved at refs/stacks/release-recovery/v1.0.1/')
    expect(await git(['rev-parse', 'HEAD'], app)).toBe(before)
    expect(await git(['rev-parse', 'refs/heads/main'], remote)).toBe(before)
    expect(await git(['rev-parse', 'refs/tags/v1.0.1'], remote)).toBe(before)
    expect(await git(['tag', '--list', 'v1.0.1'], app)).toBe('')
    const retained = await git(['for-each-ref', '--format=%(refname)', 'refs/stacks/release-recovery/'], app)
    expect(JSON.parse(await git(['show', `${retained}:package.json`], app)).version).toBe('1.0.1')

    rmSync(join(app, '.git/hooks/pre-push'))
    await git(['tag', '-d', 'v1.0.1'], remote)
    await git(['reset', '--hard', before], app)
    const success = await bump()
    expect(success.code, `${success.stdout}\n${success.stderr}`).toBe(0)
    const released = await git(['rev-parse', 'HEAD'], app)
    expect(await git(['rev-parse', 'refs/heads/main'], remote)).toBe(released)
    expect(await git(['rev-parse', 'refs/tags/v1.0.1'], remote)).toBe(released)
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 60_000)
