import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dir, '../..')
const output = join(root, 'artifacts/mobile-packed-contract')
await mkdir(output, { recursive: true })
const scratch = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'stacks-packed-mobile-'))
const commands: object[] = []
const packages: object[] = []
const publicCohort: Record<string, string> = {}
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
  visit('@stacksjs/types')
  visit('@stacksjs/mobile')
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
  const candidateArchives: Record<string, string> = {}
  const packedRoots: Record<string, string> = {}
  for (const name of await candidateClosure()) {
    const source = join(root, 'storage/framework/core', name)
    await run([process.execPath, 'run', 'build'], source)
    const archivePath = join(scratch, name + '.tgz')
    await run([process.execPath, 'pm', 'pack', '--filename', archivePath], source)
    const bytes = await readFile(archivePath)
    await writeFile(join(output, name + '.tgz'), bytes)
    const extracted = join(scratch, 'packed-' + name)
    await mkdir(extracted)
    const entries = await new Bun.Archive(bytes).extract(extracted)
    const packed = JSON.parse(await readFile(join(extracted, 'package/package.json'), 'utf8'))
    assert.equal(packed.name, '@stacksjs/' + name)
    packages.push({ name: packed.name, version: packed.version, entries, sha256: createHash('sha256').update(bytes).digest('hex'), exports: packed.exports, publishConfig: packed.publishConfig, dependencies: packed.dependencies })
    await writeFile(join(output, name + '-packed-manifest.json'), JSON.stringify(packed, null, 2) + '\n')
    candidateArchives[packed.name] = 'file:' + archivePath
    packedRoots[packed.name] = join(extracted, 'package')
  }
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const lock = Bun.JSONC.parse(await readFile(join(root, 'bun.lock'), 'utf8')) as { packages: Record<string, [string, ...unknown[]]> }
  for (const name of ['craft-native', '@stacksjs/stx', '@stacksjs/components']) {
    const locator = lock.packages[name]?.[0]
    assert.ok(locator?.startsWith(name + '@'), 'Missing exact public dependency in bun.lock: ' + name)
    publicCohort[name] = locator.slice(name.length + 1)
  }
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'stacks-packed-mobile-contract', private: true, type: 'module',
    dependencies: { ...candidateArchives, ...publicCohort },
    devDependencies: { 'better-dx': manifest.devDependencies['better-dx'] },
  }, null, 2))
  await writeFile(join(consumer, 'bunfig.toml'), '[install]\nlinker = "hoisted"\n')
  await run([process.execPath, 'install'], consumer)
  await run([process.execPath, 'install', '--frozen-lockfile'], consumer)
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
        assert.equal(createHash('sha256').update(installed).digest('hex'), createHash('sha256').update(expected).digest('hex'), name + '/' + file)
        count++
      }
    }
    return count
  }
  for (const [name, directory] of Object.entries(packedRoots))
    installedCandidateFiles[name] = await verifyInstalledFiles(name, directory)
  await writeFile(join(output, 'installed-candidate-files.json'), JSON.stringify(installedCandidateFiles, null, 2) + '\n')
  for (const name of ['package.json', 'bun.lock', 'bunfig.toml'])
    await writeFile(join(output, 'consumer-' + name), await readFile(join(consumer, name)))
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
  await writeFile(join(output, 'execution-receipt.json'), JSON.stringify({ sourceCommit, commands, packages, publicCohort, failure, scope: 'Complete actual candidate runtime closure; exact canonical public cohort; strict compiler; no workspace type aliases or package patches' }, null, 2) + '\n')
  await rm(scratch, { recursive: true, force: true })
}
