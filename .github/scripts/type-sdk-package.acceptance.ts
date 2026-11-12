import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { publicationEnvironment } from '../../storage/framework/core/actions/tests/helpers/publication-environment'
import { frameworkBuildTargets } from './build-framework'

// Build types/payments/orm explicitly before running this installed boundary.
// This gate packs their real artifacts, or uses supplied publication archives.
// It never builds or substitutes declarations.
const checkout = resolve(import.meta.dir, '../..')
const compilerOptions = { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: false, paths: {}, types: [], noEmit: true }
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

interface Candidate {
  manifest: { name: string, version: string, dependencies?: Record<string, string>, peerDependencies?: Record<string, string> }
  bytes: Uint8Array<ArrayBuffer>
  files: Map<string, File>
}

// Only prepublication checks use this owned provider. It serves unchanged,
// normally packed candidates, while unrelated dependencies retain public
// metadata and tarball URLs. External publication archives use public npm.
function candidateRegistry(candidates: Candidate[], requests: Array<Record<string, unknown>>) {
  const archiveRoutes = new Map<string, Candidate>(candidates.map((candidate, index) => [`/archives/${index}.tgz`, candidate] as const))
  const pending = new Set<AbortController>()
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, idleTimeout: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname
    const record: Record<string, unknown> = { method: request.method, path }
    requests.push(record)
    if (request.method !== 'GET') return new Response(null, { status: 405 })
    const index = candidates.findIndex(candidate => decodeURIComponent(path.slice(1)) === candidate.manifest.name)
    if (index >= 0) {
      const candidate = candidates[index]!
      record.kind = 'candidate-metadata'
      return Response.json({ name: candidate.manifest.name, 'dist-tags': { latest: candidate.manifest.version }, versions: {
        [candidate.manifest.version]: { ...candidate.manifest, dist: {
          tarball: new URL(`/archives/${index}.tgz`, request.url).href,
          shasum: createHash('sha1').update(candidate.bytes).digest('hex'),
          integrity: `sha512-${createHash('sha512').update(candidate.bytes).digest('base64')}`,
        } },
      } }, { headers: { 'cache-control': 'no-store' } })
    }
    const candidate = archiveRoutes.get(path)
    if (candidate) {
      Object.assign(record, { kind: 'candidate-archive', package: candidate.manifest.name, sha256: hash(candidate.bytes) })
      return new Response(candidate.bytes, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } })
    }
    const controller = new AbortController()
    pending.add(controller)
    const timer = setTimeout(() => controller.abort(), 60_000)
    try {
      // Never forward incoming headers, credentials or query strings.
      const upstream = new URL('https://registry.npmjs.org')
      upstream.pathname = path
      const response = await fetch(upstream, { signal: controller.signal, credentials: 'omit', redirect: 'error', headers: { accept: 'application/vnd.npm.install-v1+json, application/json' } })
      const bytes = new Uint8Array(await response.arrayBuffer())
      Object.assign(record, { kind: 'public-metadata', status: response.status, sha256: hash(bytes) })
      return new Response(bytes, { status: response.status, headers: { 'content-type': 'application/json' } })
    }
    catch (error) {
      Object.assign(record, { kind: 'public-metadata', status: 502, error: error instanceof Error ? error.name : 'FetchFailure' })
      return new Response('Public metadata request failed', { status: 502 })
    }
    finally {
      clearTimeout(timer)
      pending.delete(controller)
    }
  },
})
return {
  url: server.url.href,
  async stop() {
    for (const controller of pending) controller.abort()
    await server.stop(true)
  },
}
}
const fixtures = [
  {
    directory: 'types', name: '@stacksjs/types', sdks: ['stripe', 'meilisearch'], declaration: 'payments.d.ts',
    prefix: `import type { CheckoutOptions } from '@stacksjs/types/payments.js'
import type { TableStore } from '@stacksjs/types/tables.js'
type Lines = NonNullable<CheckoutOptions['line_items']>
type Result = NonNullable<TableStore['results']>
declare const result: Result
type IsAny<T> = 0 extends (1 & T) ? true : false;`,
    positive: `const lines: Lines = [{ price: 'price_test', quantity: 2 }];
const time: number = result.processingTimeMs;
const safeLines: false = null as unknown as IsAny<Lines[number]>;
const safeResult: false = null as unknown as IsAny<Result>;`,
    negatives: [
      { code: 2322, text: "const wrong: Lines = [{ price: 'price_test', quantity: 'wrong' }]" },
      { code: 2322, text: 'const wrong: string = result.processingTimeMs' },
    ],
  },
  {
    directory: 'payments', name: '@stacksjs/payments', sdks: ['stripe'], declaration: 'checkout-outcome.d.ts',
    prefix: `import type { CheckoutOutcome } from '@stacksjs/payments/checkout-outcome.js'
declare const outcome: CheckoutOutcome
type IsAny<T> = 0 extends (1 & T) ? true : false;`,
    positive: `const id: string = outcome.session.id;
const status: string = outcome.session.payment_status;
const safe: false = null as unknown as IsAny<CheckoutOutcome['session']>;`,
    negatives: [
      { code: 2322, text: 'const wrong: number = outcome.session.id' },
      { code: 2339, text: 'const phantom = outcome.session.notAStripeSessionMember' },
    ],
  },
  {
    directory: 'orm', name: '@stacksjs/orm', sdks: ['stripe'], declaration: 'traits/billable.d.ts',
    prefix: `import type { BillableMethods } from '@stacksjs/orm/traits/billable'
type Customer = Awaited<ReturnType<BillableMethods['createStripeUser']>>
declare const customer: Customer
type IsAny<T> = 0 extends (1 & T) ? true : false;`,
    positive: `const id: string = customer.id;
const safe: false = null as unknown as IsAny<Customer>;`,
    negatives: [
      { code: 2322, text: 'const wrong: number = customer.id' },
      { code: 2339, text: 'const phantom = customer.notAStripeCustomerMember' },
    ],
  },
  {
    directory: 'orm', name: '@stacksjs/orm', sdks: ['stripe'], declaration: 'index.d.ts',
    additional: ['@stacksjs/validation', '@stacksjs/testing', '@stacksjs/types', '@stacksjs/scheduler'],
    runtime: `import { Schedule as root } from '@stacksjs/scheduler'
import { Schedule as subpath } from '@stacksjs/scheduler/schedule'
if (root !== subpath) throw new Error('Scheduler entrypoints must share their constructor')
if (typeof subpath.prototype.everyMinute !== 'function') throw new Error('Scheduler subpath is not executable')`,
    prefix: `import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'
import type { Cdp } from '@stacksjs/testing/browser'
import type { Route, JobOptions, Schedule } from '@stacksjs/types'
const Widget = defineModel({ name: 'SDKWidget', table: 'sdk_widgets', attributes: { title: { type: 'string', validation: { rule: schema.string() } } } })
declare const cdp: Cdp
declare const schedule: Schedule
type IsAny<T> = 0 extends (1 & T) ? true : false;`,
    positive: `const row = await Widget.create({ title: 'SDK' });
const title: string = row.title;
const response = cdp.evaluate<number>('1 + 1');
const numeric: Promise<number> = response;
const routeMethod: Route['method'] = 'GET';
const job: JobOptions = { tries: 3 };
const manyRetries: JobOptions = { tries: 999 };
const timed = schedule.everyMinute();
const safeRow: false = null as unknown as IsAny<typeof row.title>;
const safeResponse: false = null as unknown as IsAny<Awaited<typeof response>>;
const safeSchema: false = null as unknown as IsAny<typeof schema>;
const safeRetryCount: false = null as unknown as IsAny<NonNullable<JobOptions['tries']>>;
const safeSchedule: false = null as unknown as IsAny<typeof timed>;`,
    negatives: [
      { code: 2322, text: "const row = await Widget.create({ title: 'SDK' }); const wrong: number = row.title" },
      { code: 2345, text: 'cdp.evaluate<number>(42)' },
      { code: 2322, text: "const method: Route['method'] = 'not-an-http-method'" },
      { code: 2322, text: "const job: JobOptions = { tries: 'many' }" },
      { code: 2322, text: 'const job: JobOptions = { tries: [1, 3] }' },
      { code: 2339, text: 'schedule.everyMinute().notAScheduleMethod()' },
    ],
  },
]
const cohortOwners = [...new Map([
  ...fixtures,
  ...fixtures.flatMap(fixture => (fixture.additional ?? []).map(name => ({ directory: name.slice('@stacksjs/'.length), name }))),
  ...['error-handling', 'config', 'router', 'cron', 'cloud', 'validation', 'testing'].map(directory => ({ directory, name: `@stacksjs/${directory}` })),
].map(owner => [owner.directory, owner])).values()]

for (const fixture of fixtures) {
  test(`${fixture.name} supplies precise SDK types through ${fixture.declaration}`, async () => {
    const evidenceBase = process.env.STACKS_TYPE_SDK_EVIDENCE ?? tmpdir()
    await mkdir(evidenceBase, { recursive: true })
    const directory = await mkdtemp(join(evidenceBase, `stacks-type-sdk-${fixture.directory}-`))
    const consumer = join(directory, 'consumer')
    const source = join(checkout, 'storage/framework/core', fixture.directory)
    const archive = join(directory, 'package.tgz')
    const commands: Array<Record<string, unknown>> = []
    const receipt: Record<string, unknown> = { package: fixture.name, source, directory, compilerOptions, commands, completed: false }
    let registry: ReturnType<typeof candidateRegistry> | undefined
    const candidates: Candidate[] = []

    async function run(phase: string, args: string[], cwd: string): Promise<{ code: number, output: string }> {
      const child = Bun.spawn(args, { cwd, env: publicationEnvironment(), stdout: 'pipe', stderr: 'pipe', timeout: 120_000 })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      const output = stdout + stderr
      const log = `${commands.length}-${phase}.log`
      await writeFile(join(directory, log), output)
      commands.push({ phase, args, cwd, code, log, diagnostics: [...output.matchAll(/error TS(\d+)/g)].map(match => Number(match[1])) })
      return { code, output }
    }

    try {
      if (process.env.STACKS_TYPE_SDK_ARCHIVES) {
        const version = process.env.STACKS_TYPE_SDK_VERSION
        if (!version) throw new Error('Actual publication archives require STACKS_TYPE_SDK_VERSION')
        for (const owner of cohortOwners) {
          const supplied = resolve(process.env.STACKS_TYPE_SDK_ARCHIVES, `${owner.directory}.tgz`)
          const bytes = new Uint8Array(await readFile(supplied))
          const files = await new Bun.Archive(bytes).files()
          const manifestFile = files.get('package/package.json')
          expect(manifestFile).toBeDefined()
          const manifest = await manifestFile!.json()
          expect(manifest.name).toBe(owner.name)
          expect(manifest.version).toBe(version)
          candidates.push({ manifest, bytes, files })
          if (owner.name === fixture.name) {
            receipt.archiveInput = supplied
            await copyFile(supplied, archive)
          }
        }
      }
      else {
        const declaration = await readFile(join(source, 'dist', fixture.declaration))
        receipt.declarationSHA256 = hash(declaration)
        const cohort: Array<Record<string, unknown>> = []
        // Exact workspace dependencies are not public yet during publication.
        // Serve the same full source cohort that the release builder selects,
        // including providers outside the ten SDKs under direct inspection.
        for (const [index, ownerDirectory] of (await frameworkBuildTargets(checkout)).entries()) {
          const owner = JSON.parse(await readFile(join(ownerDirectory, 'package.json'), 'utf8')) as { name: string }
          const candidateArchive = join(directory, `cohort-${index}.tgz`)
          const packed = await run(`pack-cohort-${index}`, [process.execPath, '--no-env-file', 'pm', 'pack', '--filename', candidateArchive], ownerDirectory)
          expect(packed.code, packed.output).toBe(0)
          const bytes = new Uint8Array(await readFile(candidateArchive))
          const files = await new Bun.Archive(bytes).files()
          const manifestFile = files.get('package/package.json')
          expect(manifestFile).toBeDefined()
          const manifest = await manifestFile!.json()
          expect(manifest.name).toBe(owner.name)
          candidates.push({ manifest, bytes, files })
          cohort.push({ name: manifest.name, version: manifest.version, archive: candidateArchive, sha256: hash(bytes) })
          if (owner.name === fixture.name) await copyFile(candidateArchive, archive)
        }
        for (const candidate of candidates) {
          for (const [name, version] of Object.entries({ ...candidate.manifest.dependencies, ...candidate.manifest.peerDependencies })) {
            if (name.startsWith('@stacksjs/') && version === candidate.manifest.version) {
              expect(candidates.some(provider => provider.manifest.name === name && provider.manifest.version === version),
              `Prepublication provider must supply ${name}@${version}, required by ${candidate.manifest.name}`).toBe(true)
            }
          }
        }
        const requests: Array<Record<string, unknown>> = []
        registry = candidateRegistry(candidates, requests)
        receipt.provider = { kind: 'owned-prepublication-candidate-registry', url: registry.url, cohort, requests, qualification: 'Candidate proof only; actual public publication is not qualified.' }
      }
      receipt.archiveSHA256 = hash(await readFile(archive))
      await mkdir(consumer)
      // Platform declarations are part of the Bun host toolchain. Provider SDKs
      // must come from the library, never from this consumer's dependencies.
      const manifest = { name: 'strict-public-sdk-consumer', private: true, type: 'module', dependencies: { [fixture.name]: `file:${archive}` }, devDependencies: { typescript: '7.0.2', '@types/bun': '1.4.4' } }
      if (fixture.additional) {
        for (const name of fixture.additional) {
          const owner = candidates.find(candidate => candidate.manifest.name === name)
          if (!owner) throw new Error(`The SDK cohort must contain ${name}`)
          Object.assign(manifest.dependencies, { [name]: owner.manifest.version })
        }
      }
      receipt.consumerManifest = manifest
      await writeFile(join(consumer, 'package.json'), JSON.stringify(manifest))
      await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions, files: ['control.ts'] }))
      if (registry) await writeFile(join(consumer, '.npmrc'), `registry=${registry.url}\n@stacksjs:registry=${registry.url}\nalways-auth=false\n`)
      const installations: Array<Record<string, unknown>> = []
      receipt.installations = installations
      for (const flags of [[], ['--frozen-lockfile']]) {
        if (flags.length) await rm(join(consumer, 'node_modules'), { recursive: true, force: true })
        const installed = await run(flags.length ? 'frozen-install' : 'install', [process.execPath, '--no-env-file', 'install', ...flags], consumer)
        expect(installed.code, installed.output).toBe(0)
        if ('runtime' in fixture) {
          await writeFile(join(consumer, 'runtime.ts'), fixture.runtime)
          const runtime = await run(flags.length ? 'frozen-runtime' : 'normal-runtime', [process.execPath, '--no-env-file', 'runtime.ts'], consumer)
          expect(runtime.code, runtime.output).toBe(0)
        }
        const lock = hash(await readFile(join(consumer, 'bun.lock')))
        if (flags.length) {
          const previous = receipt.lockSHA256
          if (typeof previous !== 'string') throw new Error('The normal installation must establish a lock hash')
          expect(lock).toBe(previous)
        }
        else receipt.lockSHA256 = lock
        const installedRoot = join(consumer, 'node_modules', fixture.name)
        const installedCandidates: Array<Record<string, unknown>> = []
        for (const candidate of candidates) {
          const manifests = new Bun.Glob(`node_modules/**/${candidate.manifest.name}/package.json`)
          for await (const manifestPath of manifests.scan({ cwd: consumer, onlyFiles: true, dot: true, followSymlinks: false })) {
            // An unscoped name also matches the tail of a scoped package
            // (`stacks` matched `@loghq/stacks`). Preserve package boundaries.
            const normalized = manifestPath.replaceAll('\\', '/')
            const suffix = `node_modules/${candidate.manifest.name}/package.json`
            if (normalized !== suffix && !normalized.endsWith(`/${suffix}`)) continue
            const identity = JSON.parse(await readFile(join(consumer, manifestPath), 'utf8')) as { name: string, version: string }
            expect(identity.name).toBe(candidate.manifest.name)
            expect(identity.version).toBe(candidate.manifest.version)
            const root = dirname(join(consumer, manifestPath))
            const inventory = await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: root, onlyFiles: true, dot: true, followSymlinks: false }))
            // Bun adds its own tag and may nest dependency installations. Check
            // those packages separately, without counting them as this payload.
            const payload = inventory.filter(name => candidate.files.has(`package/${name}`) || name !== '.bun-tag' && !name.startsWith('node_modules/'))
            expect(payload.sort()).toEqual([...candidate.files.keys()].map(name => name.slice('package/'.length)).sort())
            for (const [name, file] of candidate.files) {
              expect(name.startsWith('package/') && !name.split('/').includes('..')).toBe(true)
              const installed = await readFile(join(root, name.slice('package/'.length)))
              expect(hash(installed), `${candidate.manifest.name}/${name}`).toBe(hash(new Uint8Array(await file.arrayBuffer())))
            }
            installedCandidates.push({ name: candidate.manifest.name, version: candidate.manifest.version, root, files: candidate.files.size })
          }
        }
        expect(installedCandidates.some(candidate => candidate.name === fixture.name)).toBe(true)
        installations.push({ phase: flags.length ? 'frozen' : 'normal', lockSHA256: lock, installedCandidates })
        const installedDeclaration = await readFile(join(installedRoot, 'dist', fixture.declaration))
        if (typeof receipt.declarationSHA256 === 'string') expect(hash(installedDeclaration)).toBe(receipt.declarationSHA256)
        else receipt.declarationSHA256 = hash(installedDeclaration)
        const installedManifest = JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'))
        await writeFile(join(directory, 'installed-package.json'), JSON.stringify(installedManifest, null, 2))
        const compiler = JSON.parse(await readFile(join(consumer, 'node_modules/typescript/package.json'), 'utf8'))
        expect(compiler.version).toBe('7.0.2')
        receipt.compiler = { name: compiler.name, version: compiler.version }

        for (const [index, control] of [{ text: fixture.positive }, ...fixture.negatives].entries()) {
          await writeFile(join(consumer, 'control.ts'), `${fixture.prefix}\n${control.text}\n`)
          const checked = await run(`${flags.length ? 'frozen' : 'normal'}-control-${index}`, [process.execPath, '--no-env-file', join(consumer, 'node_modules/typescript/lib/tsc.js'), '--project', 'tsconfig.json'], consumer)
          expect(checked.code === 0, checked.output).toBe(index === 0)
          if ('code' in control) {
            expect(checked.output.match(/error TS\d+/g), checked.output).toEqual([`error TS${control.code}`])
            expect(checked.output).toContain('control.ts(')
          }
        }
        for (const sdk of fixture.sdks) {
          expect(typeof installedManifest.dependencies?.[sdk], `${fixture.name}'s public declarations require its own ${sdk} dependency`).toBe('string')
        }
      }
      receipt.completed = true
    }
    finally {
      if (registry) {
        await registry.stop()
        receipt.providerStopped = true
      }
      await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2))
      // Keep archives, locks, controls and logs as evidence; installation is reproducible.
      await rm(join(consumer, 'node_modules'), { recursive: true, force: true })
      if (!process.env.STACKS_TYPE_SDK_EVIDENCE) await rm(directory, { recursive: true, force: true })
    }
  }, 180_000)
}
