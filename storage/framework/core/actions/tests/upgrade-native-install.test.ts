import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'

const target = '0.74.66'
const newer = '0.74.70'
const upgradeModule = join(import.meta.dir, '../src/upgrade/packages.ts')

// A private registry and real Bun installation reproduce a caret upgrade
// choosing a newer release than the one the native command reports.
async function campaign(options: { installed?: string, force?: boolean, archiveVersion?: string, prefix?: string, repeat?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'stacks-native-upgrade-'))
  const app = join(root, 'app')
  mkdirSync(join(app, 'storage/framework'), { recursive: true })
  // The fixture owns no database or AI configuration. Keep those unrelated
  // app hooks explicit; the updater and Bun package installer remain real.
  writeFileSync(join(app, 'buddy'), '#!/bin/sh\ncase "$1" in generate:db-types|setup:ai) exit 0;; *) exit 73;; esac\n', { mode: 0o755 })
  const archives = new Map<string, Uint8Array>()
  const actionArchives = new Map<string, Uint8Array>()
  for (const version of [target, newer]) {
    archives.set(version, await new Bun.Archive({
      'package/package.json': JSON.stringify({ name: 'stacks', version: version === target ? (options.archiveVersion ?? version) : version, main: 'index.js', dependencies: { '@stacksjs/actions': version } }),
      'package/index.js': `export default ${JSON.stringify(version)}`,
    }, { compress: 'gzip' }).bytes())
    actionArchives.set(version, await new Bun.Archive({
      'package/package.json': JSON.stringify({ name: '@stacksjs/actions', version, exports: { './package.json': './package.json', './upgrade/framework': './dist/upgrade/framework.js' } }),
      // The installed target invokes the real owning action in a fresh
      // process. Only its metadata transport uses the private registry.
      'package/dist/upgrade/framework.js': `
const transport = globalThis.fetch
globalThis.fetch = (input, init) => transport(input.replace('https://registry.npmjs.org', process.env.NPM_CONFIG_REGISTRY), init)
await import(${JSON.stringify(join(import.meta.dir, '../src/upgrade/framework.ts'))})
throw new Error('The framework script returned instead of terminating at its package boundary')
`,
    }, { compress: 'gzip' }).bytes())
  }
  const requests: string[] = []
  const registry = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      requests.push(url.pathname)
      if (decodeURIComponent(url.pathname) === `/@stacksjs/actions/${target}`)
        return Response.json({ name: '@stacksjs/actions', version: target, dependencies: {} })
      if (decodeURIComponent(url.pathname) === '/@stacksjs/actions') {
        return Response.json({
          'name': '@stacksjs/actions',
          'dist-tags': { latest: newer },
          'versions': Object.fromEntries([...actionArchives].map(([version, bytes]) => [version, {
            name: '@stacksjs/actions', version,
            dist: { tarball: `${url.origin}/actions-${version}.tgz`, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` },
          }])),
        })
      }
      if (url.pathname === '/stacks') {
        return Response.json({
          'name': 'stacks',
          'dist-tags': { latest: newer },
          'versions': Object.fromEntries([...archives].map(([version, bytes]) => [version, {
            name: 'stacks', version,
            dependencies: { '@stacksjs/actions': version },
            dist: {
              tarball: `${url.origin}/stacks/-/stacks-${version}.tgz`,
              integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
            },
          }])),
        })
      }
      for (const [version, bytes] of archives) {
        if (url.pathname === `/stacks/-/stacks-${version}.tgz`)
          return new Response(bytes)
      }
      for (const [version, bytes] of actionArchives) {
        if (url.pathname === `/actions-${version}.tgz`)
          return new Response(bytes)
      }
      return new Response('Unknown fixture request', { status: 404 })
    },
  })
  const env = {
    ...process.env,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`,
    BUN_INSTALL_CACHE_DIR: join(root, 'cache'),
    NPM_CONFIG_REGISTRY: registry.url.origin,
  }
  writeFileSync(join(app, 'bunfig.toml'), `[install]\nregistry = ${JSON.stringify(registry.url.origin)}\n`)
  writeFileSync(join(app, '.npmrc'), `@stacksjs:registry=${registry.url.origin}\n`)
  const manifest = (version: string) => ({
    name: 'native-upgrade-consumer', private: true,
    dependencies: { stacks: `${options.prefix ?? '^'}${version}` },
  })
  async function run(args: string[], label: string) {
    const stdout = join(root, `${label}.stdout`)
    const stderr = join(root, `${label}.stderr`)
    const proc = Bun.spawn(args, { cwd: app, env, stdout: Bun.file(stdout), stderr: Bun.file(stderr) })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; proc.kill() }, 15_000)
    try {
      const code = await proc.exited
      if (timedOut)
        throw new Error(`Native ${label} timed out: ${readFileSync(stderr, 'utf8')}`)
      return { code, stdout: readFileSync(stdout, 'utf8'), stderr: readFileSync(stderr, 'utf8') }
    }
    finally { clearTimeout(timer) }
  }
  try {
    if (options.installed) {
      writeFileSync(join(app, 'package.json'), JSON.stringify(manifest(options.installed)))
      const before = await run([process.execPath, 'install', '--ignore-scripts'], 'before')
      expect(before.code, before.stderr).toBe(0)
      expect(JSON.parse(readFileSync(join(app, 'node_modules/stacks/package.json'), 'utf8')).version).toBe(options.installed)
    }
    writeFileSync(join(app, 'package.json'), JSON.stringify(manifest(target)))
    const entry = join(root, 'upgrade.ts')
    writeFileSync(entry, `
const nativeFetch = globalThis.fetch
// Only the metadata transport is redirected. Bun downloads and installs the
// actual hashed archives through the consumer's private registry settings.
globalThis.fetch = (input, init) => {
  if (typeof input !== 'string' || !input.startsWith('https://registry.npmjs.org/')) throw new Error('Unexpected metadata request')
  return nativeFetch(input.replace('https://registry.npmjs.org', ${JSON.stringify(registry.url.origin)}), init)
}
const { upgradeStacksPackages } = await import(${JSON.stringify(upgradeModule)})
await upgradeStacksPackages(process.cwd(), { version: ${JSON.stringify(target)}, force: ${options.force ?? false} })
console.log('PACKAGE_UPGRADE_RETURNED')
`)
    const result = await run([process.execPath, entry], 'upgrade')
    const repeated = options.repeat ? await run([process.execPath, entry], 'repeat') : null
    const installed = existsSync(join(app, 'node_modules/stacks/package.json')) ? JSON.parse(readFileSync(join(app, 'node_modules/stacks/package.json'), 'utf8')).version : null
    const declared = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
    const lock = existsSync(join(app, 'bun.lock')) ? Bun.JSONC.parse(readFileSync(join(app, 'bun.lock'), 'utf8')) : null
    const actions = [join(app, 'node_modules/@stacksjs/actions/package.json'), join(app, 'node_modules/stacks/node_modules/@stacksjs/actions/package.json')]
      .map(path => ({ path, manifest: existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null }))
    return { ...result, installed, declared, lock, requests, repeated, actions }
  }
  finally {
    registry.stop(true)
    rmSync(root, { recursive: true, force: true })
  }
}

describe('native package upgrade release selection', () => {
  test.each([
    ['fresh install', {}],
    ['repair a newer installed release', { installed: newer }],
    ['forced refresh', { force: true }],
    ['tilde declaration', { prefix: '~' }],
    ['exact declaration', { prefix: '' }],
  ] as const)('%s installs the requested release without advancing the caret', async (label, options) => {
    const result = await campaign(options)
    expect(result.code, `${label}: ${result.stderr}\n${JSON.stringify(result.actions)}`).toBe(0)
    expect(result.installed).toBe(target)
    expect(result.declared.dependencies).toEqual({ stacks: `${'prefix' in options ? options.prefix : '^'}${target}` })
    expect(result.lock.packages.stacks[0]).toBe(`stacks@${target}`)
    expect(result.stdout).toContain(`Upgraded to stacks@${target}`)
    expect(result.stdout.match(/PACKAGE_UPGRADE_RETURNED/g)).toHaveLength(1)
    expect(result.requests).toContain(`/stacks/-/stacks-${target}.tgz`)
    expect(result.requests.filter(path => path === `/stacks/-/stacks-${target}.tgz`)).toHaveLength(1)
  }, 30_000)

  test('retains and rejects an installed archive reporting a different release', async () => {
    const result = await campaign({ archiveVersion: newer })
    expect(result.code).toBe(1)
    expect(result.installed).toBe(newer)
    expect(result.stderr).toContain(`Requested stacks@${target}, but the installed package reports ${newer}`)
    expect(result.stdout).not.toContain('Upgraded to stacks@')
  }, 30_000)

  test('a repeated completed upgrade preserves its no-op result without reinstalling', async () => {
    const result = await campaign({ repeat: true })
    expect(result.code, result.stderr).toBe(0)
    expect(result.repeated?.code, result.repeated?.stderr).toBe(0)
    expect(result.repeated?.stdout).toContain('Already up to date')
    expect(result.repeated?.stdout).not.toContain('Installing')
    expect(result.requests.filter(path => path === `/stacks/-/stacks-${target}.tgz`)).toHaveLength(1)
  }, 30_000)
})
