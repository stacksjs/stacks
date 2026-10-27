import { expect, test } from 'bun:test'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const scripts = resolve(import.meta.dir, '../../../scripts')

test.each([
  { name: 'failed build', buildExit: 17, publishExit: 0, exportsExist: true, includeDist: true, publishes: false, succeeds: false },
  { name: 'failed publication', buildExit: 0, publishExit: 23, exportsExist: true, includeDist: true, publishes: true, succeeds: false },
  { name: 'missing public exports', buildExit: 0, publishExit: 0, exportsExist: false, includeDist: true, publishes: false, succeeds: false },
  { name: 'exports excluded from payload', buildExit: 0, publishExit: 0, exportsExist: true, includeDist: false, publishes: false, succeeds: false },
  { name: 'valid built package', buildExit: 0, publishExit: 0, exportsExist: true, includeDist: true, publishes: true, succeeds: true },
])('sample publisher: $name', async ({ buildExit, publishExit, exportsExist, includeDist, publishes, succeeds }) => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-sample-publication-'))
  const scriptDir = join(root, 'framework/scripts')
  const libraryDir = join(root, 'framework/libs/components/sample')
  const binDir = join(root, 'bin')
  const marker = join(root, 'published')
  const registryErrors: string[] = []
  const registry = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      if (request.method !== 'PUT') return Response.json({ error: 'not found' }, { status: 404 })
      try {
        if (decodeURIComponent(new URL(request.url).pathname) !== '/@stacksjs/sample-fixture'
          || request.headers.get('authorization') !== 'Bearer fixture-only-token')
          throw new Error('Unexpected fixture registry destination or authentication')
        const body = await request.json() as {
          name: string
          versions: Record<string, { name: string, version: string }>
          _attachments: Record<string, { data: string }>
        }
        if (body.name !== '@stacksjs/sample-fixture' || body.versions['1.0.0']?.version !== '1.0.0')
          throw new Error('Unexpected uploaded package identity')
        const attachments = Object.values(body._attachments)
        if (attachments.length !== 1) throw new Error('Expected one original archive')
        const bytes = Buffer.from(attachments[0]!.data, 'base64')
        await Bun.write(marker, JSON.stringify({
          sha512: `sha512-${new Bun.CryptoHasher('sha512').update(bytes).digest('base64')}`,
          sha1: new Bun.CryptoHasher('sha1').update(bytes).digest('hex'),
        }))
        return publishExit === 0
          ? Response.json({ ok: true }, { status: 201 })
          : Response.json({ error: 'fixture publication rejected' }, { status: 403 })
      }
      catch (error) {
        registryErrors.push(error instanceof Error ? error.message : String(error))
        return Response.json({ error: 'invalid fixture publication' }, { status: 400 })
      }
    },
  })
  try {
    await Promise.all([mkdir(scriptDir, { recursive: true }), mkdir(libraryDir, { recursive: true }), mkdir(binDir)])
    await writeFile(join(root, 'framework/package.json'), JSON.stringify({ name: '@stacksjs/fixture-dependency', version: '1.2.3' }))
    for (const name of ['publish-dummy-libs', 'normalize-workspace-deps-for-publish', 'validate-publish-exports.ts'])
      await copyFile(join(scripts, name), join(scriptDir, name))
    const manifest = `${JSON.stringify({
      name: '@stacksjs/sample-fixture', version: '1.0.0', type: 'module',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      files: includeDist ? ['dist'] : ['README.md'], scripts: { build: 'bun build.ts' },
      devDependencies: { '@stacksjs/fixture-dependency': 'workspace:*' },
    }, null, 2)}\n`
    await writeFile(join(libraryDir, 'package.json'), manifest)
    await writeFile(join(libraryDir, 'build.ts'), `
${exportsExist ? 'await Bun.write("dist/index.js", "export const value = 1\\n"); await Bun.write("dist/index.d.ts", "export declare const value: number\\n")' : 'await Bun.write("dist/unrelated.js", "export {}\\n")'}
process.exit(${buildExit})
`)
    // Build, pack and publish use the real Bun. Only the registry is local.
    await writeFile(join(libraryDir, '.npmrc'), `registry=${registry.url.href}\n//127.0.0.1:${registry.port}/:_authToken=fixture-only-token\n`)
    const userConfig = join(root, 'user.npmrc')
    await writeFile(userConfig, '')
    await writeFile(join(binDir, 'publish-probe.ts'), `
const archive = process.argv[3]
if (!archive?.endsWith('.tgz')) throw new Error('Registry did not receive a prepared archive')
const published = Bun.spawnSync([process.execPath, ...process.argv.slice(2), '--registry', process.env.PUBLISH_REGISTRY!], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
await Bun.write(Bun.stdout, published.stdout)
await Bun.write(Bun.stderr, published.stderr)
process.exit(published.exitCode ?? 1)
`)
    await writeFile(join(binDir, 'bun'), '#!/bin/sh\nif [ "$1" = publish ]; then exec "$REAL_BUN" "$PUBLISH_PROBE" "$@"; fi\nexec "$REAL_BUN" "$@"\n')
    await writeFile(join(binDir, 'npm'), '#!/bin/sh\nexit 1\n')
    await Promise.all(['bun', 'npm'].map(name => chmod(join(binDir, name), 0o755)))
    const env: Record<string, string | undefined> = { ...process.env }
    for (const key of Object.keys(env)) {
      if (/^(?:npm_|NPM_|NODE_AUTH_TOKEN$|BUN_(?:AUTH|CONFIG)_TOKEN$|ACTIONS_ID_TOKEN_REQUEST_)/.test(key)) delete env[key]
    }
    Object.assign(env, {
      PATH: `${binDir}:${process.env.PATH}`, REAL_BUN: process.execPath,
      PUBLISH_PROBE: join(binDir, 'publish-probe.ts'), PUBLISH_REGISTRY: registry.url.href,
      NPM_CONFIG_USERCONFIG: userConfig,
    })
    const child = Bun.spawn(['bash', join(scriptDir, 'publish-dummy-libs')], {
      cwd: root,
      env,
      stdout: 'pipe', stderr: 'pipe',
    })
    const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code === 0, out + err).toBe(succeeds)
    expect(registryErrors, out + err).toEqual([])
    expect(await Bun.file(marker).exists(), out + err).toBe(publishes)
    if (publishes) {
      const receipt = await Bun.file(marker).json() as { sha512: string, sha1: string }
      expect(out).toContain(`Payload SHA512: ${receipt.sha512}`)
      expect(out).toContain(`Payload SHA1: ${receipt.sha1}`)
    }
    expect(await readFile(join(libraryDir, 'package.json'), 'utf8')).toBe(manifest)
  }
  finally { await registry.stop(true); await rm(root, { recursive: true, force: true }) }
}, 30_000)
