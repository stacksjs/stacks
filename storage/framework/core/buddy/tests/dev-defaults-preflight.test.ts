import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

async function runFixture(state: 'stale' | 'current' | 'unstamped' | 'framework' | 'package-only' | 'vendored-only') {
  const root = await mkdtemp(join(tmpdir(), 'stacks-dev-defaults-'))
  const put = async (path: string, text: string) => {
    const full = join(root, path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, text)
  }
  try {
    await put('bunfig.toml', 'preload = []\n')
    if (state !== 'vendored-only')
      await put('node_modules/@stacksjs/defaults/package.json', JSON.stringify({ name: '@stacksjs/defaults', version: '0.74.43' }))
    if (state !== 'package-only') {
      await put('storage/framework/defaults/functions/fixture.ts', 'export const fixture = true\n')
      if (state !== 'unstamped')
        await put('storage/framework/defaults/.stacks-sync.json', JSON.stringify({ version: state === 'current' ? '0.74.43' : '0.74.19', syncedAt: '2026-09-01T00:00:00Z' }))
    }
    if (state === 'framework')
      await put('storage/framework/core/buddy/package.json', '{"name":"@stacksjs/buddy"}')
    const child = Bun.spawn([process.execPath, '--no-env-file', `${import.meta.dir}/fixtures/dev-defaults-preflight.ts`], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: ':memory:', STACKS_DEV_NO_KILL: '1', STACKS_DEV_NO_OPEN: '1' },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 8000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, output: `${stdout}\n${stderr}` }
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('dev rejects stamped defaults skew before dispatching a server', async () => {
  const { code, output } = await runFixture('stale')
  expect(code, output).toBe(1)
  expect(output).toContain('Framework defaults version mismatch')
  expect(output).toContain('0.74.19')
  expect(output).toContain('0.74.43')
  expect(output).toContain('buddy upgrade')
  expect(output).not.toContain('Booting the installed package instead')
  expect(output).not.toContain('Unknown server: fixture-unknown-server')
}, 10_000)

test.each(['current', 'unstamped', 'framework', 'package-only', 'vendored-only'] as const)('dev retains existing dispatch for %s defaults', async (state) => {
  const { code, output } = await runFixture(state)
  expect(code).toBe(9)
  expect(output).not.toContain('Framework defaults version mismatch')
  expect(output).toContain('Unknown server: fixture-unknown-server')
}, 10_000)

test('every dev command checks defaults before starting its actions or watchers', async () => {
  // The subprocess above exercises the real preflight. Pin the other entry
  // points without launching servers if a future edit removes their guard.
  const source = await readFile(new URL('../src/commands/dev.ts', import.meta.url), 'utf8')
  const commands = [...source.matchAll(/^\s*\.command\('(dev[^']*)'[\s\S]*?\.action\(async[^=]*=>\s*\{([\s\S]*?)(?=\n  buddy|\n  \/\/ buddy|\n  onUnknownSubcommand)/gm)]
  expect(commands.map(match => match[1])).toEqual([
    'dev [server]', 'dev:components', 'dev:docs', 'dev:native', 'dev:desktop',
    'dev:api', 'dev:frontend', 'dev:dashboard', 'dev:system-tray',
  ])
  for (const [, name, body] of commands) {
    const check = body!.indexOf('await checkFrameworkDefaults()')
    expect(check, name).toBeGreaterThanOrEqual(0)
    const work = body!.search(/await (?:intro\(|actions\(|runCommand\(|\(await actions\(\)\)|startDevelopmentServer\()/)
    expect(work, name).toBeGreaterThan(check)
  }
})
