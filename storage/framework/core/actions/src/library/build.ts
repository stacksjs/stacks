import type { LibraryConfig } from '@stacksjs/types'
import type { LibraryManifest } from './manifest'
import type { ResolvedLibraryPackage } from './packages'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { transpilePackage, validateDeclarations, validateRuntimeExports } from '@stacksjs/build'
import { library } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { buildComponentLibrary } from '@stacksjs/stx'
import { functionEntryData } from './entries'
import { ambientGlobalsUsed, stxAmbientGlobals } from './globals'
import { libraryManifest, serializeManifest } from './manifest'
import { LibraryConfigError, resolveLibraryPackages } from './packages'

export interface LibraryBuildReport {
  name: string
  kind: string
  dir: string
  sources: number
}

export interface LibraryPackageBuildOptions {
  /** Restrict the run to these kinds. Omitted means every configured package. */
  kinds?: Array<ResolvedLibraryPackage['kind']>
  config?: LibraryConfig
  /**
   * Compile to `dist/`. When false, sources are staged and manifests written
   * but nothing is built — what `buddy generate:entries` needs, and what makes
   * a release validate its library config before it tags anything.
   */
  compile?: boolean
  /**
   * Treat "no packages configured" as nothing to do rather than an error. True
   * for the release path (most apps ship no library); false for an explicit
   * `buddy build:functions`, where silence is the bug being fixed.
   */
  allowEmpty?: boolean
}

/**
 * Stage, generate and build every configured library package of the given
 * kinds. Returns one report per package so callers can say what they built
 * instead of exiting 0 in silence.
 */
export async function buildLibraryPackages(options: LibraryPackageBuildOptions = {}): Promise<LibraryBuildReport[]> {
  const config = options.config ?? library
  const kinds = options.kinds
  const compile = options.compile ?? true
  const all = await resolveLibraryPackages(config, { onUnmatched: options.allowEmpty ? 'skip' : 'error' })
  const packages = kinds ? all.filter(pkg => kinds.includes(pkg.kind)) : all

  if (!packages.length) {
    if (options.allowEmpty) {
      log.info('No library packages are configured. Nothing to build.')
      return []
    }

    throw new LibraryConfigError(
      kinds
        ? `No ${kinds.join('/')} packages are configured. Add one to \`packages\` in config/library.ts.`
        : 'No library packages are configured. Add one to `packages` in config/library.ts.',
    )
  }

  const version = await projectVersion()
  const reports: LibraryBuildReport[] = []

  for (const pkg of packages) {
    const verb = compile ? 'Building' : 'Generating'
    log.info(`${verb} ${pkg.name} (${pkg.kind}, ${pkg.sources.length} source${pkg.sources.length === 1 ? '' : 's'})...`)

    if (compile)
      await rm(resolve(pkg.dir, 'dist'), { recursive: true, force: true })

    await mkdir(pkg.dir, { recursive: true })

    if (pkg.kind === 'functions')
      await buildFunctionPackage(pkg, config, version, compile)
    else
      await buildComponentPackage(pkg, config, version, compile)

    reports.push({ name: pkg.name, kind: pkg.kind, dir: pkg.dir, sources: pkg.sources.length })

    if (compile)
      log.success(`Built ${pkg.name} → ${relative(projectPath(), pkg.dir)}/dist`)
  }

  return reports
}

/** Stage sources and write manifests without compiling. */
export async function generateLibraryPackages(options: Omit<LibraryPackageBuildOptions, 'compile'> = {}): Promise<LibraryBuildReport[]> {
  return buildLibraryPackages({ ...options, compile: false })
}

/**
 * Copy the claimed sources into the package, generate its barrel, then run the
 * same transpile every other framework package uses.
 *
 * The copy is what makes the package self-contained. Importing the sources in
 * place would emit `../../../../resources/functions/counter.js` into `dist`,
 * an import that escapes the published tarball and resolves to nothing on a
 * consumer's disk — the exact shape of failure that took three releases to
 * spot the last time it shipped.
 */
async function buildFunctionPackage(pkg: ResolvedLibraryPackage, config: LibraryConfig | undefined, version: string, compile: boolean): Promise<void> {
  await assertPublishable(pkg)

  const srcDir = resolve(pkg.dir, 'src')
  await rm(srcDir, { recursive: true, force: true })

  const staged: string[] = []

  for (const source of pkg.sources) {
    const destination = resolve(srcDir, relative(pkg.sourceDir, source))
    await mkdir(dirname(destination), { recursive: true })
    await Bun.write(destination, await Bun.file(source).text())
    staged.push(destination)
  }

  const entry = resolve(srcDir, 'index.ts')

  // A source literally named `index.ts` would be overwritten by the barrel.
  if (staged.includes(entry)) {
    throw new LibraryConfigError(
      `Package "${pkg.name}" claims resources/functions/index.ts, which collides with the generated barrel. Rename it or exclude it.`,
    )
  }

  await Bun.write(entry, functionEntryData(pkg, staged))
  await writeManifest(pkg, config, version)

  if (!compile)
    return

  await transpilePackage({
    dir: pkg.dir,
    pkgName: pkg.name,
    external: ['@stacksjs/*', 'bun', ...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)],
  })

  await validateDeclarations(pkg.dir)
  await validateRuntimeExports(pkg.dir)
}

/**
 * Compile the claimed `.stx` files into a custom-element library.
 *
 * No barrel is generated: `buildComponentLibrary` emits its own index, and
 * each component registers its tag on import, so the `web-components` flavor
 * is the same build published through `bundle.js` instead of `index.js`.
 */
async function buildComponentPackage(pkg: ResolvedLibraryPackage, config: LibraryConfig | undefined, version: string, compile: boolean): Promise<void> {
  if (!compile) {
    await writeManifest(pkg, config, version)
    return
  }

  const result = await buildComponentLibrary({
    inputDir: pkg.sourceDir,
    outputDir: resolve(pkg.dir, 'dist'),
    prefix: pkg.prefix,
    components: pkg.sources.map((source) => {
      const file = relative(pkg.sourceDir, source)
      const stem = file.replace(/\.stx$/, '').split('/').at(-1) as string

      return pkg.names[stem] ? { file, name: pkg.names[stem] } : { file }
    }),
    progressive: true,
    manifest: true,
    declarations: true,
    css: true,
    bundle: true,
    minify: true,
    sourcemap: pkg.sourcemap ? 'external' : false,
  })

  log.debug(`${pkg.name}: compiled ${result.components.length} components (${result.totalBytes} bytes)`)

  await writeManifest(pkg, config, version)
}

/**
 * Refuse to publish sources that only work inside an stx page.
 *
 * `state`, `useDark` and friends are ambient: nothing exports them, so a
 * bundled copy of `counter.ts` compiles fine and throws
 * `ReferenceError: state is not defined` in the consumer's app. Catching it
 * here costs a config line; catching it after publishing costs a version.
 */
async function assertPublishable(pkg: ResolvedLibraryPackage): Promise<void> {
  if (pkg.runtime === 'stx')
    return

  const globals = await stxAmbientGlobals()

  if (!globals.size)
    return

  const offenders: string[] = []

  for (const source of pkg.sources) {
    const used = ambientGlobalsUsed(await Bun.file(source).text(), globals)

    if (used.length)
      offenders.push(`  ${relative(projectPath(), source)} → ${used.join(', ')}`)
  }

  if (!offenders.length)
    return

  throw new LibraryConfigError(
    `Package "${pkg.name}" uses stx's ambient globals, which no module exports:\n${offenders.join('\n')}\n\n`
    + 'A consumer importing the published package would hit a ReferenceError. Either import those names explicitly '
    + `in the source, or set \`runtime: 'stx'\` on the package in config/library.ts to declare that it is only ever `
    + 'consumed from inside an stx app.',
  )
}

async function writeManifest(pkg: ResolvedLibraryPackage, config: LibraryConfig | undefined, version: string): Promise<void> {
  const manifest = libraryManifest(
    pkg,
    config,
    version,
    pkg.sources.map(source => relative(projectPath(), source)),
  )

  await Bun.write(resolve(pkg.dir, 'package.json'), serializeManifest(withRuntime(manifest, pkg)))
}

function withRuntime(manifest: LibraryManifest, pkg: ResolvedLibraryPackage): LibraryManifest {
  if (pkg.runtime !== 'stx')
    return manifest

  return {
    ...manifest,
    stacks: { ...manifest.stacks, runtime: 'stx' },
  }
}

/**
 * Library packages follow the project version by default, so a release tags
 * one version and every package it publishes carries it.
 */
export async function projectVersion(): Promise<string> {
  const manifest = await Bun.file(projectPath('package.json')).json() as { version?: string }

  return manifest.version ?? '0.0.0'
}
