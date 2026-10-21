/** Offline desktop apps use stx's native packager without a server or database. */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
  pkg.devDependencies = { '@stacksjs/buddy': `^${options.buddyVersion}`, ...pkg.devDependencies }
  pkg.dependencies = { '@stacksjs/stx': `^${options.stxVersion}`, '@stacksjs/desktop': `^${options.stxVersion}`, ...pkg.dependencies }
  pkg.scripts = { dev: './buddy dev', build: './buddy build', package: './buddy package', ...pkg.scripts }

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
  if (!options.adopt) writeMissing('src/app.stx', `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title></head>\n<body><h1>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h1><p>Your Stacks native app is ready.</p></body>\n</html>\n`)
  writeMissing('.gitignore', 'node_modules/\ndist/\n.stx/\n')
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
  const output = resolve(root, config.output ?? 'dist')
  if (output === root || !output.startsWith(`${root}/`)) throw new Error('Native output must be a directory inside the app.')
  const result = await buildNative({
    ...config,
    input: resolve(root, config.input ?? 'src/app.stx'),
    output,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    ...(config.icon ? { icon: resolve(root, config.icon) } : {}),
    ...(config.backend ? { backend: { ...config.backend, entry: resolve(root, config.backend.entry) } } : {}),
    ...(args.includes('--dmg') ? { format: 'dmg' } : {}),
    verbose: args.includes('--verbose'),
  })
  if (!result.success || !result.outputPath) throw new Error(result.error ?? 'Native build produced no artifact.')
  return result.outputPath
}

/** Return false to let the ordinary Buddy registry handle unrelated commands. */
export async function runNativeProjectCommand(root: string, args: string[]): Promise<boolean> {
  const [command = 'help', ...flags] = args
  if (!['build', 'build:desktop', 'build:native', 'package', 'dev', 'dev:desktop', 'dev:native', 'upgrade', 'update'].includes(command))
    return false
  if (flags.includes('--help') || flags.includes('-h')) {
    console.log(`buddy ${command} (native app)\n\nBuild: --dmg --verbose\nUpgrade: --dry-run\n\nConfiguration: craft.config.ts. Runtime: craft on PATH, or CRAFT_BIN.`)
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
