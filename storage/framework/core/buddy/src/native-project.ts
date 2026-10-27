/** Standalone native apps use stx and Pantry without the web framework boot. */
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { nativeProjectTemplates } from './native-project-templates'
import { setEnv } from '@stacksjs/env/cli'
import { generateAppKey } from '@stacksjs/security/key'
import { auditNativeEnvironment, defaultCraftRuntime, prepareNativeAppBuild, readNativeAppConfig, recordNativeArtifact } from 'ts-pantry/native'

interface NativePackage {
  name?: string
  version?: string
  description?: string
  author?: string
  stacks?: { type?: string }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

export function isNativeProject(root: string): boolean {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).stacks?.type === 'native'
  }
  catch { return false }
}

/** Adoption adds only missing integration files and preserves application source. */
export function scaffoldNativeProject(root: string, options: { adopt?: boolean, buddyVersion: string, stxVersion: string }): void {
  const manifest = join(root, 'package.json')
  if (existsSync(root) && readdirSync(root).some(name => name !== '.git') && !options.adopt)
    throw new Error(`Path ${root} already exists. Use --adopt to integrate an existing native app.`)
  if (options.adopt && (!existsSync(manifest) || !existsSync(join(root, 'craft.config.ts'))))
    throw new Error('--adopt requires package.json and craft.config.ts; no files were changed.')

  const pkg: NativePackage = existsSync(manifest)
    ? JSON.parse(readFileSync(manifest, 'utf8'))
    : { name: basename(root), version: '0.1.0', description: 'A Stacks native app' }
  if (pkg.stacks?.type && pkg.stacks.type !== 'native')
    throw new Error('This project already declares a different Stacks application type.')
  const name = basename(root).replace(/(^|[-_ ])\w/g, word => word.replace(/[-_ ]/g, ' ').toUpperCase())
  pkg.stacks = { ...pkg.stacks, type: 'native' }
  pkg.devDependencies = { '@buddysh/buddy': '^0.11.13', '@stacksjs/buddy': `^${options.buddyVersion}`, ...pkg.devDependencies }
  pkg.dependencies = { '@stacksjs/stx': `^${options.stxVersion}`, '@stacksjs/desktop': `^${options.stxVersion}`, ...pkg.dependencies }
  pkg.scripts = { dev: './buddy dev', build: './buddy build', package: './buddy package', 'release:patch': './buddy release --bump patch', 'release:minor': './buddy release --bump minor', 'release:major': './buddy release --bump major', ...pkg.scripts }

  mkdirSync(root, { recursive: true })
  const writeMissing = (name: string, content: string) => {
    const file = join(root, name)
    if (existsSync(file)) return
    mkdirSync(resolve(file, '..'), { recursive: true })
    writeFileSync(file, content)
  }
  writeMissing('buddy', `#!/bin/sh\nset -eu\ncd -- "$(dirname -- "$0")"\nBUDDY_NATIVE_ENTRY=$(bun --print 'Bun.resolveSync("@stacksjs/buddy/cli", process.cwd())')\nexec bun "$BUDDY_NATIVE_ENTRY" "$@"\n`)
  chmodSync(join(root, 'buddy'), 0o755)
  writeMissing('craft.config.ts', `export default {\n  name: ${JSON.stringify(name)},\n  input: 'src/app.stx',\n  target: 'macos',\n  bundleId: ${JSON.stringify(`com.example.${basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`)},\n  window: { title: ${JSON.stringify(name)}, width: 640, height: 480 },\n}\n`)
  const pantryFile = join(root, 'pantry.json')
  const pantry = existsSync(pantryFile) ? JSON.parse(readFileSync(pantryFile, 'utf8')) : {}
  pantry.native = { environment: 'production', runtime: defaultCraftRuntime, ...pantry.native, macos: { notarize: true, ...pantry.native?.macos } }
  writeFileSync(pantryFile, `${JSON.stringify(pantry, null, 2)}\n`)
  if (!options.adopt) writeMissing('src/app.stx', `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title></head>\n<body><h1>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h1><p>Your Stacks native app is ready.</p></body>\n</html>\n`)
  for (const [destination, source] of Object.entries(nativeProjectTemplates))
    writeMissing(destination, source.replaceAll('__APP_SLUG__', pkg.name ?? basename(root)))
  writeMissing('.github/renovate.json', `${JSON.stringify({ enabled: false }, null, 2)}\n`)
  writeMissing('.gitignore', 'node_modules/\ndist/\n.stx/\n.pantry/\n')
  const ignoreFile = join(root, '.gitignore')
  let ignore = readFileSync(ignoreFile, 'utf8')
  for (const pattern of ['.env.keys', '.env.local', '.env.*.local']) {
    if (!ignore.split('\n').includes(pattern)) ignore = `${ignore.trimEnd()}\n${pattern}\n`
  }
  // Protect the private half before generating any keys, including on failure.
  writeFileSync(ignoreFile, ignore)
  if (!existsSync(join(root, '.env.production'))) {
    for (const [key, value] of Object.entries({ APP_ENV: 'production', APP_KEY: generateAppKey() })) {
      const result = setEnv(key, value, { cwd: root, file: '.env.production' })
      if (!result.success) throw new Error(result.error || 'Could not create the native production environment')
    }
  }
  auditNativeEnvironment(root, 'production')
  if (!ignore.split('\n').includes('!.env.production')) writeFileSync(ignoreFile, `${ignore.trimEnd()}\n!.env.production\n`)
  writeFileSync(manifest, `${JSON.stringify(pkg, null, 2)}\n`)
}

export async function buildNativeProject(root: string, args: string[] = []): Promise<string> {
  const pkg: NativePackage = await Bun.file(join(root, 'package.json')).json()
  const loaded = await import(pathToFileURL(join(root, 'craft.config.ts')).href)
  const config = loaded.default ?? loaded.config
  if (!config || typeof config !== 'object') throw new Error('craft.config.ts must export a native build configuration.')
  // Resolve from the app: its declared stx version owns compilation, even when
  // Buddy itself is running from a local framework checkout.
  const { buildNative } = await import(pathToFileURL(Bun.resolveSync('@stacksjs/stx/craft', root)).href)
  const prepared = await prepareNativeAppBuild(root, config)
  try {
    const output = resolve(root, prepared.overrides.output ?? config.output ?? 'dist')
    if (output === root || !output.startsWith(`${root}/`)) throw new Error('Native output must be a directory inside the app.')
    const buildNumber = process.env.PANTRY_BUILD_NUMBER || config.infoPlist?.CFBundleVersion || pkg.version
    const result = await buildNative({
      ...config,
      ...prepared.overrides,
      input: resolve(root, config.input ?? 'src/app.stx'),
      output,
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      infoPlist: { ...config.infoPlist, CFBundleVersion: buildNumber },
      ...(config.icon ? { icon: resolve(root, config.icon) } : {}),
      ...(config.backend ? { backend: { ...config.backend, entry: resolve(root, config.backend.entry) } } : {}),
      ...(args.includes('--dmg') ? { format: 'dmg' } : {}),
      verbose: args.includes('--verbose'),
    })
    if (!result.success || !result.outputPath) throw new Error(result.error ?? 'Native build produced no artifact.')
    if (readNativeAppConfig(root)) recordNativeArtifact(root, {
      path: result.outputPath,
      ...(result.target === 'macos' ? { appPath: join(output, `${config.name}.app`) } : {}),
      name: config.name,
      bundleId: config.bundleId,
      version: pkg.version!,
      buildNumber: String(buildNumber),
      target: result.target,
      minimumSystemVersion: config.minimumSystemVersion,
    })
    return result.outputPath
  }
  finally { prepared.cleanup() }
}

/** Return false to let the ordinary Buddy registry handle unrelated commands. */
export async function runNativeProjectCommand(root: string, args: string[]): Promise<boolean> {
  const [command = 'help', ...flags] = args
  if (!['build', 'build:desktop', 'build:native', 'package', 'dev', 'dev:desktop', 'dev:native', 'upgrade', 'update', 'release', 'desktop:apple:package', 'desktop:apple:publish', 'desktop:apple:submit'].includes(command))
    return false
  if (flags.includes('--site')) {
    const { runNativeSiteCommand } = await import('./native-site')
    await runNativeSiteCommand(root, command, flags)
    return true
  }
  if (flags.includes('--help') || flags.includes('-h')) {
    console.log(`buddy ${command} (native app)\n\nBuild: --dmg --verbose\nUpgrade: --dry-run\nRelease: --bump patch|minor|major --dry-run\nApple: --build-number N --validate-only --submit-for-review\n\nApplication: craft.config.ts. Runtime and publishing: pantry.json. Development runtime override: CRAFT_BIN.`)
    return true
  }
  if (command.startsWith('desktop:apple:')) {
    const options = parseNativeAppleFlags(flags)
    const { publishNativeApple, submitNativeApple } = await import('ts-pantry/native')
    if (command === 'desktop:apple:submit') {
      if (!options.buildNumber) throw new Error('Submitting an uploaded build requires --build-number N')
      if (options.validateOnly || options.packageOnly) throw new Error('Submit does not support package-only or validation-only')
      const loaded = await import(pathToFileURL(join(root, 'craft.config.ts')).href)
      const config = loaded.default ?? loaded.config
      if (!config?.bundleId) throw new Error('craft.config.ts must declare bundleId')
      await submitNativeApple(root, { ...options, buildNumber: options.buildNumber, bundleId: config.bundleId })
    }
    else {
      await publishNativeApple(root, { ...options, ...(command === 'desktop:apple:package' ? { packageOnly: true } : {}) })
    }
    return true
  }
  if (command === 'release') {
    const index = flags.indexOf('--bump')
    const bump = index >= 0 ? flags[index + 1] : 'patch'
    if (!bump || !['patch', 'minor', 'major'].includes(bump) || flags.some((flag, position) => flag !== '--dry-run' && flag !== '--bump' && !(index >= 0 && position === index + 1)))
      throw new Error('Native releases support --bump patch|minor|major and --dry-run')
    const { releaseNativeApp } = await import('ts-pantry/native/release')
    await releaseNativeApp(root, { bump: bump as 'patch' | 'minor' | 'major', dryRun: flags.includes('--dry-run') })
    return true
  }
  if (command === 'upgrade' || command === 'update') {
    // Native apps have independently versioned stx/desktop dependencies. They
    // have no framework defaults, route generation, or migrations to sync.
    if (flags.some(flag => flag !== '--dry-run' && flag !== '--verbose'))
      throw new Error('Native upgrades support --dry-run and --verbose. Use bun add to select a specific package version.')
    if (flags.includes('--dry-run')) console.log('Would run bun update for the native app; no files changed.')
    else {
      const proc = Bun.spawn(['bun', 'update'], { cwd: root, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
      if (await proc.exited !== 0) throw new Error('Native dependency upgrade failed.')
    }
    return true
  }
  const artifact = await buildNativeProject(root, command === 'package' ? [...flags, '--dmg'] : flags)
  console.log(`Built ${artifact}`)
  if (command.startsWith('dev')) {
    const config = (await import(pathToFileURL(join(root, 'craft.config.ts')).href)).default
    if (process.platform !== 'darwin') throw new Error('Native development launch currently requires macOS.')
    const executable = join(artifact, 'Contents', 'MacOS', config.name)
    const child = Bun.spawn([executable], { cwd: root, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
    let interrupted = false
    const stop = () => { interrupted = true; child.kill('SIGTERM') }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    try {
      const code = await child.exited
      if (code !== 0 && !interrupted) throw new Error(`Native app exited with ${child.signalCode ?? `code ${code}`}.`)
    }
    finally {
      process.removeListener('SIGINT', stop)
      process.removeListener('SIGTERM', stop)
    }
  }
  return true
}

/** Reject misspelled release flags before building, signing or contacting Apple. */
export function parseNativeAppleFlags(flags: string[]): { buildNumber?: string, packageOnly?: boolean, validateOnly?: boolean, submitForReview?: boolean } {
  const options: ReturnType<typeof parseNativeAppleFlags> = {}
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index]
    if (flag === '--build-number') {
      const value = flags[++index]
      if (!value || !/^[1-9]\d*$/.test(value)) throw new Error('--build-number requires a positive integer')
      options.buildNumber = value
    }
    else if (flag === '--package-only') options.packageOnly = true
    else if (flag === '--validate-only') options.validateOnly = true
    else if (flag === '--submit-for-review') options.submitForReview = true
    else throw new Error(`Unsupported native Apple option: ${flag}`)
  }
  if (options.packageOnly && (options.validateOnly || options.submitForReview)) throw new Error('Package-only cannot validate or submit a release')
  if (options.validateOnly && options.submitForReview) throw new Error('Validation-only cannot submit a release')
  return options
}
