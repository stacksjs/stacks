import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'

// Exercise the real compiled command and Bun installer. The target package's
// arbitrary future migration is a protocol witness, not a copy of the current
// framework's retirement registry. Its old counterpart must never execute.
const target = '999.0.1'
const previous = '0.0.1-fixture.1'
const originalTypecheck = 'bun tsc --noEmit -p storage/framework/core/tsconfig.json'
const root = mkdtempSync(join(tmpdir(), 'buddy-installed-upgrade-'))
const binary = join(root, process.platform === 'win32' ? 'buddy.exe' : 'buddy')

async function run(cmd: string[], cwd: string, env: Record<string, string | undefined>, timeout = 15_000) {
  const child = Bun.spawn(cmd, { cwd, env, stdout: 'pipe', stderr: 'pipe', timeout })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

beforeAll(async () => {
  const entry = join(root, 'entry.ts')
  writeFileSync(entry, `
const transport = globalThis.fetch
globalThis.fetch = (input, init) => {
  if (typeof input !== 'string' || !input.startsWith('https://registry.npmjs.org/')) throw new Error('Unexpected metadata transport')
  return transport(input.replace('https://registry.npmjs.org', process.env.UPGRADE_FIXTURE_REGISTRY), init)
}
const { cli } = await import(${JSON.stringify(join(import.meta.dir, '../../cli/src/index.ts'))})
const { upgrade } = await import(${JSON.stringify(join(import.meta.dir, '../src/commands/upgrade.ts'))})
const buddy = cli('buddy')
upgrade(buddy)
buddy.parse()
`)
  const built = await run([process.execPath, 'build', entry, '--compile', '--conditions=development', '--outfile', binary], root, process.env, 30_000)
  expect(built.code, built.stderr).toBe(0)
}, 35_000)

afterAll(() => rmSync(root, { recursive: true, force: true }))

async function campaign(options: { flags?: string[], exitCode?: number, actionVersion?: string, missingEntry?: boolean, vendoredOverride?: boolean } = {}) {
  const app = mkdtempSync(join(root, 'app-'))
  const archives = new Map<string, Uint8Array>()
  for (const version of [previous, target]) {
    const action = version === previous
      ? `await Bun.write('old-upgrader-ran', 'old'); process.exit(74)`
      : `
import { appendFileSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
if (!process.argv.includes('--__restarted')) throw new Error('Target migration lacks its handoff marker')
if (JSON.parse(readFileSync('node_modules/stacks/package.json', 'utf8')).version !== ${JSON.stringify(target)}) throw new Error('Wrong installed target')
appendFileSync('target-migrations.jsonl', JSON.stringify({ argv: process.argv.slice(2), entry: import.meta.path }) + '\\n')
if (${options.exitCode ?? 0}) process.exit(${options.exitCode ?? 0})
if (readFileSync('future-scaffold.txt', 'utf8') !== 'retired by the future target') throw new Error('Bootstrap modified target-owned scaffold')
const project = JSON.parse(readFileSync('package.json', 'utf8'))
if (project.scripts.typecheck !== ${JSON.stringify(originalTypecheck)}) throw new Error('Bootstrap preempted target-owned script migration')
project.scripts.typecheck = 'future-target-check'
writeFileSync('package.json', JSON.stringify(project))
unlinkSync('future-scaffold.txt')
writeFileSync('target-finished', 'complete')
`
    archives.set(`@stacksjs/actions@${version}`, await new Bun.Archive({
      'package/package.json': JSON.stringify({ name: '@stacksjs/actions', version: version === target ? options.actionVersion ?? version : version, exports: { './package.json': './package.json', './upgrade/framework': './dist/upgrade/framework.js' } }),
      ...(options.missingEntry && version === target ? {} : { 'package/dist/upgrade/framework.js': action }),
    }, { compress: 'gzip' }).bytes())
    archives.set(`stacks@${version}`, await new Bun.Archive({
      'package/package.json': JSON.stringify({ name: 'stacks', version, dependencies: { '@stacksjs/actions': version } }),
    }, { compress: 'gzip' }).bytes())
  }
  const requests: string[] = []
  const registry = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch(request) {
      const url = new URL(request.url)
      const path = decodeURIComponent(url.pathname)
      requests.push(path)
      for (const name of ['stacks', '@stacksjs/actions']) {
        const versions = Object.fromEntries([previous, target].map(version => {
          const bytes = archives.get(`${name}@${version}`)!
          return [version, {
            name, version, dependencies: name === 'stacks' ? { '@stacksjs/actions': version } : {},
            dist: { tarball: `${url.origin}/archives/${encodeURIComponent(name)}/${version}`, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` },
          }]
        }))
        if (path === `/${name}`) return Response.json({ name, 'dist-tags': { latest: target }, versions })
        if (path === `/${name}/${target}`) return Response.json(versions[target])
        for (const version of [previous, target]) {
          if (path === `/archives/${name}/${version}`) return new Response(archives.get(`${name}@${version}`))
        }
      }
      return new Response('Unknown fixture request', { status: 404 })
    },
  })
  const env = {
    ...process.env,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`,
    BUN_INSTALL_CACHE_DIR: join(app, 'cache'),
    NPM_CONFIG_REGISTRY: registry.url.origin,
    UPGRADE_FIXTURE_REGISTRY: registry.url.origin,
  }
  writeFileSync(join(app, 'bunfig.toml'), `[install]\nregistry = ${JSON.stringify(registry.url.origin)}\n`)
  writeFileSync(join(app, '.npmrc'), `@stacksjs:registry=${registry.url.origin}\n`)
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'old-framework-consumer', private: true, dependencies: { stacks: previous }, scripts: { typecheck: originalTypecheck } }))
  writeFileSync(join(app, 'future-scaffold.txt'), 'retired by the future target')
  if (options.vendoredOverride) {
    const directory = join(app, 'storage/framework/core/actions/src/upgrade')
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'framework.ts'), `await Bun.write('vendored-override-ran', 'explicit'); process.exit(0)`)
  }
  try {
    const installed = await run([process.execPath, 'install', '--ignore-scripts'], app, env)
    expect(installed.code, `${installed.stderr}\nRequests: ${JSON.stringify(requests)}`).toBe(0)
    const before = Object.fromEntries(['package.json', 'bun.lock', 'future-scaffold.txt'].map(path => [path, readFileSync(join(app, path), 'utf8')]))
    const result = await run([binary, 'upgrade', '--version', target, ...options.flags ?? []], app, env)
    const after = Object.fromEntries(Object.keys(before).map(path => [path, existsSync(join(app, path)) ? readFileSync(join(app, path), 'utf8') : null]))
    return {
      ...result, before, after, requests,
      oldRan: existsSync(join(app, 'old-upgrader-ran')),
      vendoredRan: existsSync(join(app, 'vendored-override-ran')),
      finished: existsSync(join(app, 'target-finished')),
      migrations: existsSync(join(app, 'target-migrations.jsonl')) ? readFileSync(join(app, 'target-migrations.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as { argv: string[], entry: string }) : [],
      installed: JSON.parse(readFileSync(join(app, 'node_modules/stacks/package.json'), 'utf8')).version,
    }
  }
  finally { registry.stop(true); rmSync(app, { recursive: true, force: true }) }
}

test('a compiled upgrade bypasses the old project action and runs a newer target migration once', async () => {
  const result = await campaign({ flags: ['--force', '--allow-downgrade'] })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.oldRan).toBe(false)
  expect(result.installed).toBe(target)
  expect(result.finished).toBe(true)
  expect(result.after['future-scaffold.txt']).toBeNull()
  expect(JSON.parse(result.after['package.json']!).scripts.typecheck).toBe('future-target-check')
  expect(result.migrations).toHaveLength(1)
  expect(result.migrations[0]!.entry).toContain('/node_modules/@stacksjs/actions/dist/upgrade/framework.js')
  expect(result.migrations[0]!.argv).toContain(target)
  expect(result.migrations[0]!.argv).toContain('--force')
  expect(result.migrations[0]!.argv).toContain('--allowDowngrade')
}, 30_000)

test('the target migration failure remains a failed upgrade with the same exit code', async () => {
  const result = await campaign({ exitCode: 17 })
  expect(result.code, result.stdout + result.stderr).toBe(17)
  expect(result.oldRan).toBe(false)
  expect(result.finished).toBe(false)
  expect(result.migrations).toHaveLength(1)
  expect(result.after['future-scaffold.txt']).toBe(result.before['future-scaffold.txt'])
  expect(result.stdout).not.toContain('Upgraded to stacks@')
}, 30_000)

test('an installed actions package with the wrong identity is retained and rejected', async () => {
  const result = await campaign({ actionVersion: previous })
  expect(result.code, result.stdout + result.stderr).not.toBe(0)
  expect(result.oldRan).toBe(false)
  expect(result.installed).toBe(target)
  expect(result.migrations).toHaveLength(0)
  expect(result.stderr).toContain('installed @stacksjs/actions')
}, 30_000)

test('a target missing its upgrade entry fails without falling back to the old action', async () => {
  const result = await campaign({ missingEntry: true })
  expect(result.code, result.stdout + result.stderr).not.toBe(0)
  expect(result.oldRan).toBe(false)
  expect(result.installed).toBe(target)
  expect(result.migrations).toHaveLength(0)
  expect(result.stderr).toContain('has no framework upgrade entry')
}, 30_000)

test('an explicitly vendored core keeps its project upgrade override', async () => {
  const result = await campaign({ vendoredOverride: true })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.vendoredRan).toBe(true)
  expect(result.oldRan).toBe(false)
  expect(result.installed).toBe(previous)
  expect(result.migrations).toHaveLength(0)
  expect(result.after['future-scaffold.txt']).toBe(result.before['future-scaffold.txt'])
}, 30_000)

test('dry-run is read-only and never invokes either installed action', async () => {
  const result = await campaign({ flags: ['--dry-run'] })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.after).toEqual(result.before)
  expect(result.installed).toBe(previous)
  expect(result.oldRan).toBe(false)
  expect(result.migrations).toHaveLength(0)
}, 30_000)

test('no-postinstall updates the manifest without installing or running target migrations', async () => {
  const result = await campaign({ flags: ['--no-postinstall'] })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(JSON.parse(result.after['package.json']!).dependencies.stacks).toBe(target)
  expect(result.after['bun.lock']).toBe(result.before['bun.lock'])
  expect(result.installed).toBe(previous)
  expect(result.oldRan).toBe(false)
  expect(result.migrations).toHaveLength(0)
}, 30_000)
