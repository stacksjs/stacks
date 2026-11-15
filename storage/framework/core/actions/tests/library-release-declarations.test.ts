import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The shipped package interface is the seam: real builds and archives, an
// isolated node_modules, and a strict consumer with no framework source paths.
// This catches leaked declaration dependencies and private package subpaths;
// runtime release effects have their own owned-registry fixtures.
test('packed native release interfaces compile without the framework model graph', async () => {
  const framework = join(import.meta.dir, '../..')
  const repository = join(framework, '../../..')
  const runtime = join(framework, '../runtime')
  await mkdir(runtime, { recursive: true })
  const workspace = await mkdtemp(join(runtime, 'release-declaration-build-'))
  const consumer = await mkdtemp(join(tmpdir(), 'stacks-release-declaration-consumer-'))
  const home = join(consumer, 'home')
  await mkdir(home)
  const environment = {
    PATH: process.env.PATH,
    HOME: home,
    APP_ENV: 'test',
    SystemRoot: process.env.SystemRoot,
    NPM_CONFIG_USERCONFIG: join(home, '.npmrc'),
    NPM_CONFIG_CACHE: join(home, 'npm-cache'),
    BUN_INSTALL_CACHE_DIR: join(home, 'bun-cache'),
  }
  await writeFile(environment.NPM_CONFIG_USERCONFIG, '')
  function run(args: string[], cwd: string): string {
    const result = Bun.spawnSync(args, { cwd, env: environment, stdout: 'pipe', stderr: 'pipe', timeout: 45_000 })
    const output = result.stdout.toString() + result.stderr.toString()
    expect(result.exitCode, output.slice(-12_000)).toBe(0)
    return output
  }
  try {
    await symlink(join(framework, 'build'), join(workspace, 'build'), 'dir')
    await writeFile(join(workspace, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler' } }))
    for (const name of ['types', 'actions']) {
      const source = join(framework, name), output = join(workspace, name)
      await mkdir(output)
      await cp(join(source, 'src'), join(output, 'src'), { recursive: true })
      await cp(join(source, 'package.json'), join(output, 'package.json'))
      await cp(join(source, 'build.ts'), join(output, 'build.ts'))
      await writeFile(join(output, 'tsconfig.json'), JSON.stringify({ extends: join(source, 'tsconfig.json') }))
      if (name === 'actions') {
        // A rebuild must remove the previously shipped private adapter too.
        await mkdir(join(output, 'dist/library'), { recursive: true })
        await writeFile(join(output, 'dist/library/installed-internal.js'), 'export function verifyInstalledFiles() {}')
        await writeFile(join(output, 'dist/library/installed-internal.d.ts'), 'export declare function verifyInstalledFiles(): void')
      }
      run([process.execPath, 'run', 'build'], output)
      run(['node', join(framework, '../scripts/normalize-workspace-deps-for-publish'), join(output, 'package.json'), join(framework, '..')], repository)
      const archive = join(workspace, `${name}.tgz`)
      run([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', archive], output)
      const installed = join(consumer, 'node_modules/@stacksjs', name)
      await mkdir(installed, { recursive: true })
      // Read the real tar payload, rather than substituting source files or
      // resolving undeclared framework packages from the monorepo.
      const files = await new Bun.Archive(await Bun.file(archive).arrayBuffer()).files()
      expect(files.has('package/dist/library/installed-internal.js')).toBe(false)
      expect(files.has('package/dist/library/installed-internal.d.ts')).toBe(false)
      for (const [path, file] of files) {
        expect(path.startsWith('package/')).toBe(true)
        const relative = path.slice('package/'.length)
        const destination = join(installed, relative)
        await mkdir(join(destination, '..'), { recursive: true })
        await Bun.write(destination, file)
      }
    }
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'native-release-interface-consumer', private: true, type: 'module' }))
    await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, skipLibCheck: false, noEmit: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler', lib: ['ESNext', 'DOM'], types: [] },
      files: ['consumer.ts'],
    }))
    await writeFile(join(consumer, 'consumer.ts'), `
import type { LibraryConfig, LibraryReleaseOptions } from '@stacksjs/types/library'
import { planNativeLibraryRelease } from '@stacksjs/actions/library/release-plan'
import { prepareNativeLibraryRelease, publishNativeLibraryRelease, readbackNativeLibraryRelease } from '@stacksjs/actions/library/release-lifecycle'
import { resolveLibraryRegistryReadAuth } from '@stacksjs/actions/library/release-registry-auth'
import { inspectInstalledLibraryPackage } from '@stacksjs/actions/library/installed'
// @ts-expect-error The legacy dependency policy is implementation-private.
import { verifyInstalledFiles } from '@stacksjs/actions/library/installed-internal'
// @ts-expect-error The private adapter is unavailable through the .js spelling too.
import { verifyInstalledFiles as privateJs } from '@stacksjs/actions/library/installed-internal.js'
// @ts-expect-error Repeated separators cannot expose the private policy.
import { verifyInstalledFiles as privateAlias } from '@stacksjs/actions/library//installed-internal'
// @ts-expect-error Co-located legacy policy stays module-private.
import { verifyInstalledFiles as privatePolicy } from '@stacksjs/actions/release-evidence'
void [verifyInstalledFiles, privateJs, privateAlias, privatePolicy]
const installed: Map<string, Uint8Array> = inspectInstalledLibraryPackage('package', new Map<string, Uint8Array>(), { consumerRoot: '.', allowBunTag: true, maxEntries: 100, maxDepth: 8, maxBytes: 1024, maxFileBytes: 512 })
// @ts-expect-error Installed payloads contain bytes, not strings.
const invalidInstalled: Map<string, string> = installed
// @ts-expect-error Arbitrary installed file exemptions are unsupported.
inspectInstalledLibraryPackage('package', new Map<string, Uint8Array>(), { ignoreFiles: ['private.ts'] })
const release: LibraryReleaseOptions = { publisher: 'bun', distTag: 'alpha' }
const config: LibraryConfig = { releaseable: true, repository: 'example/widgets', release, packages: [{ name: '@example/widgets', kind: 'functions', registry: 'npm' }] }
// @ts-expect-error Only supported publishers can be configured.
const invalid: LibraryReleaseOptions = { publisher: 'unsupported' }
const auth = resolveLibraryRegistryReadAuth({}, { NPM_READ_TOKEN: 'synthetic-read-only' })
const registry: string | undefined = auth?.registry
// @ts-expect-error Registry read tokens are strings.
resolveLibraryRegistryReadAuth({ readAuth: { registry: 'https://registry.example.test', token: 42 } }, {})
async function check() {
  const plan = await planNativeLibraryRelease({ cwd: '.', config })
  const version: string | undefined = plan?.packages[0]?.version
  const prepared = await prepareNativeLibraryRelease({ cwd: '.', directory: 'retained', dryRun: true })
  if (prepared.prepared) {
    const preparedVersion: string | undefined = prepared.candidate.packages[0]?.version
    // @ts-expect-error Prepared candidate versions are strings.
    const invalidVersion: number = prepared.candidate.packages[0]!.version
    void [preparedVersion, invalidVersion]
  }
  const receipt = await readbackNativeLibraryRelease({ cwd: '.', directory: 'retained' })
  const integrity: string | undefined = receipt.packages[0]?.integrity
  const registryOrigin: string | undefined = receipt.packages[0]?.registryOrigin
  // @ts-expect-error Receipts omit opaque download URLs, which may carry credentials.
  const download = receipt.packages[0]?.tarball
  const published = await publishNativeLibraryRelease({ cwd: '.', directory: 'retained', dryRun: true, readAuth: auth })
  const publishedVersion: string | undefined = published.packages[0]?.version
  // @ts-expect-error Archive identities remain typed at the emitted interface.
  const invalidIntegrity: number = receipt.packages[0]!.integrity
  return [version, integrity, registryOrigin, download, publishedVersion, invalidIntegrity]
}
void [config, invalid, registry, check, invalidInstalled]
`)
    run([join(repository, 'node_modules/.bin/tsc'), '-p', join(consumer, 'tsconfig.json')], consumer)
    const installedProbe = `
const { inspectInstalledLibraryPackage } = await import('@stacksjs/actions/library/installed')
for (const subpath of ['library/installed-internal', 'library/installed-internal.js', 'library//installed-internal', 'library//installed-internal.js', 'library/%69nstalled-internal', 'library/installed-internal?probe', 'library/installed-internal.js?probe']) {
  let blocked = false
  try { await import('@stacksjs/actions/' + subpath) } catch (error) {
    blocked = ['ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_INVALID_MODULE_SPECIFIER'].includes(error.code)
  }
  if (!blocked) throw new Error('Private package subpath remains accessible: ' + subpath)
}
for (const specifier of ['@stacksjs/actions/release-evidence', '@stacksjs/actions//release-evidence', '@stacksjs/actions/%72elease-evidence', './node_modules/@stacksjs/actions/dist/release-evidence.js', './node_modules/@stacksjs/actions/dist/release-evidence.js?probe']) {
  const namespace = await import(specifier)
  if (Object.keys(namespace).sort().join(',') !== 'inspectInstalledLibraryPackage,validateReleaseEvidencePlan,verifyReleaseEvidence') throw new Error('Legacy implementation exports private policy: ' + specifier)
}
const facade = await import('@stacksjs/actions/library/installed')
if (Object.keys(facade).join(',') !== 'inspectInstalledLibraryPackage') throw new Error('Installed facade exports private policy')
const { mkdirSync, writeFileSync, rmSync } = await import('node:fs')
mkdirSync('installed-fixture', { recursive: true })
writeFileSync('installed-fixture/package.json', '{}')
const expected = new Map([['package.json', new TextEncoder().encode('{}')]])
if (inspectInstalledLibraryPackage('installed-fixture', expected, { consumerRoot: '.' }).size !== 1) throw new Error('Missing installed payload')
mkdirSync('installed-fixture/.bun-tag')
for (const options of [undefined, { allowBunTag: true }]) {
  let markerRejected = false
  try { inspectInstalledLibraryPackage('installed-fixture', expected, options) } catch { markerRejected = true }
  if (!markerRejected) throw new Error('Installed payload accepted a directory as Bun metadata')
}
rmSync('installed-fixture/.bun-tag', { recursive: true })
writeFileSync('installed-fixture/private.ts', 'private source')
let extraRejected = false
try { inspectInstalledLibraryPackage('installed-fixture', expected) } catch { extraRejected = true }
if (!extraRejected) throw new Error('Installed payload ignored an extra private file')
rmSync('installed-fixture/private.ts')
mkdirSync('installed-fixture/node_modules/private', { recursive: true })
writeFileSync('installed-fixture/node_modules/private/leak.ts', 'private source')
let rejected = false
try { inspectInstalledLibraryPackage('installed-fixture', expected) } catch { rejected = true }
if (!rejected) throw new Error('Installed payload ignored extra files')
rmSync('installed-fixture', { recursive: true })
`
    await writeFile(join(consumer, 'runtime.ts'), `
import assert from 'node:assert/strict'
assert.equal(Bun.resolveSync('@stacksjs/types/library', import.meta.dir), import.meta.dir + '/node_modules/@stacksjs/types/dist/library.js')
await import('@stacksjs/types/library')
${installedProbe}
const { resolveLibraryRegistryReadAuth } = await import('@stacksjs/actions/library/release-registry-auth')
assert.equal(resolveLibraryRegistryReadAuth({}, { NPM_READ_TOKEN: 'synthetic-read-only' }).registry, 'https://registry.npmjs.org')
`)
    run([process.execPath, 'runtime.ts'], consumer)
    run(['node', '--input-type=module', '--eval', `
await import('@stacksjs/types/library')
${installedProbe}
const { resolveLibraryRegistryReadAuth } = await import('@stacksjs/actions/library/release-registry-auth')
if (resolveLibraryRegistryReadAuth({}, { NPM_READ_TOKEN: 'synthetic-read-only' }).registry !== 'https://registry.npmjs.org') throw new Error('Missing public registry interface')
`], consumer)
  }
  finally {
    await rm(workspace, { recursive: true, force: true })
    await rm(consumer, { recursive: true, force: true })
  }
}, 120_000)
