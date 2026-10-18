import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dir, '../..')
const output = join(root, 'artifacts/mobile-packed-contract')
await mkdir(output, { recursive: true })
const scratch = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'stacks-packed-mobile-'))
const commands: object[] = []
const packages: object[] = []
let failure: string | undefined

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
  const consumer = join(scratch, 'consumer')
  await mkdir(consumer)
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'stacks-packed-mobile-contract', private: true, type: 'module',
    dependencies: { 'craft-native': '0.0.238', '@stacksjs/stx': '0.2.567', '@stacksjs/components': '0.2.567' },
    devDependencies: { 'better-dx': manifest.devDependencies['better-dx'] },
  }, null, 2))
  await writeFile(join(consumer, 'bunfig.toml'), '[install]\nlinker = "hoisted"\n')
  await run([process.execPath, 'install'], consumer)
  await run([process.execPath, 'install', '--frozen-lockfile'], consumer)
  const installedVersions: Record<string, string> = {}
  for (const [name, version] of Object.entries({ 'craft-native': '0.0.238', '@stacksjs/stx': '0.2.567', '@stacksjs/components': '0.2.567' })) {
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules', name, 'package.json'), 'utf8'))
    assert.equal(installed.version, version)
    installedVersions[name] = installed.version
  }
  await writeFile(join(output, 'public-cohort.json'), JSON.stringify(installedVersions, null, 2) + '\n')

  for (const name of ['types', 'mobile']) {
    const source = join(root, 'storage/framework/core', name)
    await run([process.execPath, 'run', 'build'], source)
    const archivePath = join(scratch, name + '.tgz')
    await run([process.execPath, 'pm', 'pack', '--filename', archivePath], source)
    const bytes = await readFile(archivePath)
    const extracted = join(scratch, 'packed-' + name)
    await mkdir(extracted)
    const entries = await new Bun.Archive(bytes).extract(extracted)
    const packed = JSON.parse(await readFile(join(extracted, 'package/package.json'), 'utf8'))
    assert.equal(packed.name, '@stacksjs/' + name)
    packages.push({ name: packed.name, version: packed.version, entries, sha256: createHash('sha256').update(bytes).digest('hex'), exports: packed.exports, publishConfig: packed.publishConfig, dependencies: packed.dependencies })
    await writeFile(join(output, name + '-packed-manifest.json'), JSON.stringify(packed, null, 2) + '\n')
    const destination = join(consumer, 'node_modules/@stacksjs', name)
    await mkdir(dirname(destination), { recursive: true })
    // Consume exact packed bytes in this isolated contract. Never rewrite
    // exports/declarations or resolve the candidate through workspace aliases.
    await rename(join(extracted, 'package'), destination)
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
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler', strict: true,
    skipLibCheck: false, noUncheckedIndexedAccess: true, noEmit: true,
    types: ['bun'], lib: ['ESNext', 'DOM'],
  }, files: ['consumer.ts'] }, null, 2))
  const compiler = resolve(dirname(Bun.resolveSync('typescript', consumer)), '../bin/tsc')
  await run([process.execPath, compiler, '--project', join(consumer, 'tsconfig.json'), '--pretty', 'false'], consumer)
}
catch (error) {
  failure = error instanceof Error ? error.message : String(error)
  throw error
}
finally {
  await writeFile(join(output, 'execution-receipt.json'), JSON.stringify({ commands, packages, failure, scope: 'Actual candidate packs; exact public SDK238/STX567; strict compiler; no workspace type aliases or package patches' }, null, 2) + '\n')
  await rm(scratch, { recursive: true, force: true })
}
