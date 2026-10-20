import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dir, '../..')
const frameworkRoot = process.argv.includes('--framework-root')
const output = join(root, 'artifacts/mobile-packed-contract', ...(frameworkRoot ? ['framework-root'] : []))
await mkdir(output, { recursive: true })
const scratch = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'stacks-packed-mobile-'))
const commands: object[] = []
const packages: object[] = []
const publicCohort: Record<string, string> = {}
const registryRequests: string[] = []
let registry: ReturnType<typeof Bun.serve> | undefined
let failure: string | undefined
let sourceCommit: string | undefined

interface CandidateManifest {
  name: string
  version: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/** Pack the candidate's runtime closure so no unpublished sibling is fetched. */
async function candidateClosure(): Promise<string[]> {
  const core = join(root, 'storage/framework/core')
  const candidates = new Map<string, { directory: string, manifest: CandidateManifest }>()
  for (const entry of await readdir(core, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = Bun.file(join(core, entry.name, 'package.json'))
    if (await file.exists()) {
      const manifest = await file.json() as CandidateManifest
      candidates.set(manifest.name, { directory: entry.name, manifest })
    }
  }
  if (frameworkRoot) {
    const manifest = await Bun.file(join(core, 'package.json')).json() as CandidateManifest
    candidates.set(manifest.name, { directory: '', manifest })
  }
  const seen = new Set<string>()
  const ordered: string[] = []
  function visit(name: string): void {
    if (seen.has(name)) return
    const candidate = candidates.get(name)
    assert.ok(candidate, 'Missing candidate source for ' + name)
    seen.add(name)
    for (const dependency of Object.keys({ ...candidate.manifest.dependencies, ...candidate.manifest.optionalDependencies })) {
      if (candidates.has(dependency)) visit(dependency)
    }
    ordered.push(candidate.directory)
  }
  if (frameworkRoot) visit('stacks')
  else {
    visit('@stacksjs/types')
    visit('@stacksjs/mobile')
  }
  return ordered
}

async function run(args: string[], cwd: string): Promise<string> {
  const started = performance.now()
  const child = Bun.spawn(args, { cwd, env: { ...process.env, APP_ENV: 'test', NO_COLOR: '1' }, stdout: 'pipe', stderr: 'pipe' })
  let killed = false
  const timer = setTimeout(() => { killed = true; child.kill() }, 180_000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    commands.push({ args, cwd, code, killed, elapsed: performance.now() - started, stdout, stderr })
    console.log(stdout + stderr)
    assert.equal(killed, false, 'Command exceeded its owned deadline: ' + args.join(' '))
    assert.equal(code, 0, args.join(' ') + '\n' + stdout + stderr)
    return stdout.trim()
  }
  finally {
    clearTimeout(timer)
    if (child.exitCode === null) { child.kill(); await child.exited }
  }
}

try {
  sourceCommit = await run(['git', 'rev-parse', 'HEAD'], root)
  await writeFile(join(output, 'source-commit.txt'), sourceCommit + '\n')
  const consumer = join(scratch, 'consumer')
  await mkdir(consumer)
  const candidateVersions: Record<string, string> = {}
  const candidateArtifacts = new Map<string, { manifest: CandidateManifest, bytes: Buffer }>()
  const packedRoots: Record<string, string> = {}
  for (const name of await candidateClosure()) {
    const source = join(root, 'storage/framework/core', name)
    await run([process.execPath, 'run', name ? 'build' : 'build:exports'], source)
    const artifactName = name || 'stacks'
    const archivePath = join(scratch, artifactName + '.tgz')
    await run([process.execPath, 'pm', 'pack', '--filename', archivePath], source)
    const bytes = await readFile(archivePath)
    await writeFile(join(output, artifactName + '.tgz'), bytes)
    const extracted = join(scratch, 'packed-' + artifactName)
    await mkdir(extracted)
    const entries = await new Bun.Archive(bytes).extract(extracted)
    const packed = JSON.parse(await readFile(join(extracted, 'package/package.json'), 'utf8'))
    assert.equal(packed.name, (await Bun.file(join(source, 'package.json')).json()).name)
    packages.push({ name: packed.name, version: packed.version, entries, sha256: createHash('sha256').update(bytes).digest('hex'), exports: packed.exports, publishConfig: packed.publishConfig, dependencies: packed.dependencies })
    await writeFile(join(output, artifactName + '-packed-manifest.json'), JSON.stringify(packed, null, 2) + '\n')
    candidateVersions[packed.name] = packed.version
    candidateArtifacts.set(packed.name, { manifest: packed, bytes })
    packedRoots[packed.name] = join(extracted, 'package')
  }
  // Install with normal registry/semver semantics, including transitive exact
  // sibling versions. A file: root dependency does not supply those registry
  // records in Bun. The fixture serves the original archives without edits.
  registry = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      if (request.method !== 'GET') return new Response(null, { status: 405 })
      const path = new URL(request.url).pathname.slice(1)
      registryRequests.push(path)
      for (const [name, artifact] of candidateArtifacts) {
        if (decodeURIComponent(path) === `archives/${name}.tgz`)
          return new Response(artifact.bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
      }
      const name = decodeURIComponent(path)
      const candidate = candidateArtifacts.get(name)
      if (candidate) {
        return Response.json({
          name,
          'dist-tags': { latest: candidate.manifest.version },
          versions: { [candidate.manifest.version]: {
            ...candidate.manifest,
            dist: {
              tarball: new URL(`/archives/${encodeURIComponent(name)}.tgz`, request.url).href,
              shasum: createHash('sha1').update(candidate.bytes).digest('hex'),
              integrity: 'sha512-' + createHash('sha512').update(candidate.bytes).digest('base64'),
            },
          } },
        })
      }
      // Public peers retain their real registry metadata and tarball URLs.
      // No incoming headers or credentials are forwarded to the public origin.
      const upstream = await fetch('https://registry.npmjs.org/' + encodeURIComponent(name), { signal: AbortSignal.timeout(15_000) })
      return Response.json(await upstream.json(), { status: upstream.status })
    },
  })
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const lock = Bun.JSONC.parse(await readFile(join(root, 'bun.lock'), 'utf8')) as { packages: Record<string, [string, ...unknown[]]> }
  for (const name of ['craft-native', '@stacksjs/stx', '@stacksjs/components', 'bun-plugin-stx', 'bun-query-builder', 'ts-pantry']) {
    const locator = lock.packages[name]?.[0]
    assert.ok(locator?.startsWith(name + '@'), 'Missing exact public dependency in bun.lock: ' + name)
    publicCohort[name] = locator.slice(name.length + 1)
  }
  for (const name of ['@stacksjs/components', 'bun-plugin-stx']) {
    assert.equal(publicCohort[name], publicCohort['@stacksjs/stx'], 'The compiler, components and runtime must use the same stx release')
  }
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'stacks-packed-mobile-contract', private: true, type: 'module',
    dependencies: { ...candidateVersions, ...publicCohort },
    devDependencies: { 'better-dx': manifest.devDependencies['better-dx'] },
  }, null, 2))
  await writeFile(join(consumer, 'bunfig.toml'), '[install]\nlinker = "hoisted"\n' + (frameworkRoot ? 'registry = ' + JSON.stringify(registry.url.href) + '\n' : '') + '[install.scopes]\n"@stacksjs" = ' + JSON.stringify(registry.url.href) + '\n')
  await writeFile(join(consumer, '.npmrc'), (frameworkRoot ? 'registry=' + registry.url.href + '\n' : '') + '@stacksjs:registry=' + registry.url.href + '\n')
  await run([process.execPath, 'install', '--cache-dir', join(scratch, 'install-cache')], consumer)
  await run([process.execPath, 'install', '--frozen-lockfile', '--cache-dir', join(scratch, 'install-cache')], consumer)
  const installedVersions: Record<string, string> = {}
  for (const [name, version] of Object.entries(publicCohort)) {
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules', name, 'package.json'), 'utf8'))
    assert.equal(installed.version, version)
    installedVersions[name] = installed.version
  }
  await writeFile(join(output, 'public-cohort.json'), JSON.stringify(installedVersions, null, 2) + '\n')

  // The ordinary installer owns the complete candidate dependency graph.
  // Compare every installed candidate file to the untouched archive, including
  // package.json and declarations; this never modifies an installed package.
  const installedCandidateFiles: Record<string, number> = {}
  async function verifyInstalledFiles(name: string, directory: string, relative = ''): Promise<number> {
    let count = 0
    for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
      const file = join(relative, entry.name)
      if (entry.isDirectory()) {
        count += await verifyInstalledFiles(name, directory, file)
      }
      else {
        assert.equal(entry.isFile(), true, 'Candidate archive contains an unsupported file: ' + file)
        const expected = await readFile(join(directory, file))
        const installed = await readFile(join(consumer, 'node_modules', name, file))
        if (!installed.equals(expected)) {
          const retained = join(output, 'mismatch', name, file)
          await mkdir(dirname(retained), { recursive: true })
          await writeFile(retained + '.archive', expected)
          await writeFile(retained + '.installed', installed)
        }
        assert.equal(createHash('sha256').update(installed).digest('hex'), createHash('sha256').update(expected).digest('hex'), name + '/' + file)
        count++
      }
    }
    return count
  }
  for (const [name, directory] of Object.entries(packedRoots))
    installedCandidateFiles[name] = await verifyInstalledFiles(name, directory)
  await writeFile(join(output, 'installed-candidate-files.json'), JSON.stringify(installedCandidateFiles, null, 2) + '\n')
  for (const name of ['package.json', 'bun.lock', 'bunfig.toml', '.npmrc'])
    await writeFile(join(output, 'consumer-' + name), await readFile(join(consumer, name)))
  if (frameworkRoot) {
    await writeFile(join(consumer, 'framework-root-consumer.js'), [
      "import * as framework from 'stacks'",
      "import * as buddy from '@stacksjs/buddy'",
      "import { capabilityRegistry } from '@stacksjs/config/capabilities'",
      "import { loadProbeRecords } from '@stacksjs/desktop-build/probe'",
      "import * as runner from '@stacksjs/desktop-build/probe/runner'",
      "import { FEATURE_NAMES } from '@stacksjs/features/names'",
      "if (Object.keys(framework).length !== Object.keys(buddy).length) throw new Error('Root export count mismatch')",
      "for (const name of Object.keys(buddy)) if (framework[name] !== buddy[name]) throw new Error('Root export identity mismatch: ' + name)",
      "void [capabilityRegistry, loadProbeRecords, runner, FEATURE_NAMES]",
      "console.log('PASS actual packed framework root, CLI namespace identity and public documentation dependencies')",
    ].join('\n'))
    await run([process.execPath, 'framework-root-consumer.js'], consumer)
  }
  await writeFile(join(consumer, 'consumer.ts'), [
    "import type { IosMobileConfig } from '@stacksjs/types/mobile'",
    "import { prepareIosSimulatorDriver } from '@stacksjs/mobile/testing'",
    'declare const config: IosMobileConfig',
    "const driver: { output: string, projectName: string } = prepareIosSimulatorDriver(config, '/tmp/packed-mobile')",
    '// @ts-expect-error native restoration roots are paths, not numbers',
    'prepareIosSimulatorDriver(config, 42)',
    '// @ts-expect-error the public iOS configuration keeps app names typed',
    "const invalid: IosMobileConfig = { appName: 42, bundleId: 'org.example.packed' }",
    'void [driver, invalid]',
  ].join('\n'))
  // Compile the public root ownership/storage/UUID contract from the same
  // authored fixture as the package test, against these exact packed bytes.
  const rootConsumer = await readFile(join(root, 'storage/framework/core/mobile/tests/fixtures/consumer.ts'), 'utf8')
  await writeFile(join(consumer, 'mobile-root-consumer.ts'), rootConsumer)
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler', strict: true,
    skipLibCheck: false, noUncheckedIndexedAccess: true, noEmit: true,
    types: ['bun'], lib: ['ESNext', 'DOM'],
  }, files: ['consumer.ts', 'mobile-root-consumer.ts'] }, null, 2))
  const compiler = resolve(dirname(Bun.resolveSync('typescript', consumer)), '../bin/tsc')
  await run([process.execPath, compiler, '--project', join(consumer, 'tsconfig.json'), '--pretty', 'false'], consumer)
}
catch (error) {
  failure = error instanceof Error ? error.message : String(error)
  throw error
}
finally {
  registry?.stop(true)
  await writeFile(join(output, 'execution-receipt.json'), JSON.stringify({ sourceCommit, commands, packages, publicCohort, registryRequests, failure, scope: 'Complete actual candidate runtime closure through an owned npm fixture; untouched archives; exact canonical public cohort; strict compiler; no workspace type aliases or package patches' }, null, 2) + '\n')
  await rm(scratch, { recursive: true, force: true })
}
