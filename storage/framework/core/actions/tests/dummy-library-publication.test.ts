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
    // Only registry operations are replaced. Build and pack use the real Bun.
    await writeFile(join(binDir, 'publish-probe.ts'), `
import { createHash } from 'node:crypto'
const archive = process.argv[3]
if (!archive?.endsWith('.tgz')) throw new Error('Registry did not receive a prepared archive')
const bytes = new Uint8Array(await Bun.file(archive).arrayBuffer())
const dryRun = Bun.spawnSync([process.execPath, 'publish', archive, '--dry-run', '--access', 'public', '--ignore-scripts'], { stdout: 'pipe', stderr: 'pipe' })
if (dryRun.exitCode !== 0) throw new Error(new TextDecoder().decode(dryRun.stderr))
await Bun.write(process.env.PUBLISH_MARKER!, JSON.stringify({ sha512: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), sha1: createHash('sha1').update(bytes).digest('hex') }))
process.exit(Number(process.env.PUBLISH_EXIT))
`)
    await writeFile(join(binDir, 'bun'), '#!/bin/sh\nif [ "$1" = publish ]; then exec "$REAL_BUN" "$PUBLISH_PROBE" "$@"; fi\nexec "$REAL_BUN" "$@"\n')
    await writeFile(join(binDir, 'npm'), '#!/bin/sh\nexit 1\n')
    await Promise.all(['bun', 'npm'].map(name => chmod(join(binDir, name), 0o755)))
    const child = Bun.spawn(['bash', join(scriptDir, 'publish-dummy-libs')], {
      cwd: root,
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, REAL_BUN: process.execPath, PUBLISH_MARKER: marker, PUBLISH_PROBE: join(binDir, 'publish-probe.ts'), PUBLISH_EXIT: String(publishExit) },
      stdout: 'pipe', stderr: 'pipe',
    })
    const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code === 0, out + err).toBe(succeeds)
    expect(await Bun.file(marker).exists(), out + err).toBe(publishes)
    if (publishes) {
      const receipt = await Bun.file(marker).json() as { sha512: string, sha1: string }
      expect(out).toContain(receipt.sha512)
      expect(out).toContain(receipt.sha1)
    }
    expect(await readFile(join(libraryDir, 'package.json'), 'utf8')).toBe(manifest)
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 30_000)
