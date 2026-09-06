/**
 * Repairing a project that has just stopped vendoring the framework.
 *
 * `unpublish:core --all` deletes `storage/framework/core`. Everything here
 * exists because a project references that directory from more places than its
 * package.json: imports that name a source file, shell commands that run an
 * action the long way round, bundler entrypoints, CI path filters. Each one
 * keeps working right up until the directory goes, and then fails somewhere far
 * away from the change that caused it.
 *
 * Split out of `commands/publish.ts` so the rewrites can be exercised on their
 * own — they edit files across the whole project, which is not something to
 * find out about from a deploy.
 */
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { log } from '@stacksjs/cli'
import { fs } from '@stacksjs/storage'

/**
 * Does this path exist as a symlink whose target does not?
 *
 * `existsSync` follows the link, so it answers "no" for both a missing link and
 * a dangling one; only the second is ours to clean up.
 */
export function isDanglingLink(target: string): boolean {
  try {
    // `existsSync` follows the link, so a link that lstat can see and
    // existsSync cannot is exactly a link whose target is gone.
    return lstatSync(target).isSymbolicLink() && !existsSync(target)
  }
  catch {
    return false
  }
}

/**
 * The package manager this project actually installs with.
 *
 * An app installed with pantry has no node_modules at all, so running `bun
 * install` at the end of an unvendor writes a second, competing dependency
 * tree that the `./buddy` shim does not read — the install "succeeds" and the
 * project still cannot resolve a single @stacksjs package.
 */
/** True when `bunfig.toml` asks for the hoisted dependency layout. */
function hoistedLinker(cwd: string): boolean {
  try {
    const bunfig = readFileSync(resolve(cwd, 'bunfig.toml'), 'utf-8')
    return /^\s*linker\s*=\s*["']hoisted["']/m.test(bunfig)
  }
  catch {
    return false
  }
}

export function detectInstaller(cwd: string): string[] {
  const has = (rel: string) => existsSync(resolve(cwd, rel))
  const usesPantry = has('pantry') || (has('pantry.lock') && !has('node_modules'))

  if (usesPantry && Bun.which('pantry')) {
    /*
     * Carry the project's linker through. `pantry install` defaults to the
     * isolated layout regardless of what `bunfig.toml` asks for, which puts a
     * transitive package at `node_modules/.bun/@types+bun@1.4.1/node_modules/
     * @types/bun`. TypeScript's default `typeRoots` walks `node_modules/@types`
     * upward and never looks there, so a scaffolded app failed its first
     * typecheck with
     *
     *     error TS2688: Cannot find type definition file for 'bun'
     *
     * even though `better-dx`, which ships `@types/bun`, was installed.
     *
     * Worse, running it over a tree `bun install` had already hoisted MOVED the
     * hoisted copy aside into `node_modules/.old_modules-<hash>/`, so the types
     * went from present to absent.
     *
     * AGENTS.md already requires `linker = "hoisted"` wherever `better-dx` is a
     * dependency; this makes the install honour it.
     */
    if (hoistedLinker(cwd))
      return ['pantry', 'install', '--linker', 'hoisted']

    return ['pantry', 'install']
  }

  if (usesPantry)
    log.warn('This project installs with pantry, but no `pantry` binary is on PATH — falling back to `bun install`.')

  return ['bun', 'install']
}

/**
 * Repoint package manifests that remain under `storage/framework` after core
 * is removed. These directories are standalone build/runtime packages rather
 * than root workspace members, so walking only `package.json#workspaces`
 * misses them and leaves `workspace:*` ranges that no longer resolve.
 */
export async function rewriteSurvivingFrameworkManifests(
  cwd: string,
  provided: Set<string>,
  range: string,
): Promise<{ files: string[], ranges: number }> {
  const framework = resolve(cwd, 'storage/framework')
  const files: string[] = []
  let ranges = 0

  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    }
    catch {
      return
    }

    for (const entry of entries) {
      if (entry.name === 'core' || entry.name === 'node_modules' || entry.name === 'dist')
        continue

      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile() || entry.name !== 'package.json')
        continue

      const raw = await fs.promises.readFile(full, 'utf-8')
      const pkg = JSON.parse(raw) as Record<string, Record<string, string> | undefined>
      let touched = false

      for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const dependencies = pkg[field]
        if (!dependencies)
          continue

        for (const [name, spec] of Object.entries(dependencies)) {
          if (!spec.startsWith('workspace:') || !provided.has(name))
            continue
          dependencies[name] = range
          ranges++
          touched = true
        }
      }

      if (!touched)
        continue

      await fs.promises.writeFile(full, `${JSON.stringify(pkg, null, 2)}\n`)
      files.push(full.replace(`${cwd}/`, ''))
    }
  }

  await walk(framework)
  return { files, ranges }
}

/**
 * Files worth rewriting or scanning: the project's own code and config, never
 * the dependency trees or build output (which are reinstalled/regenerated) and
 * never storage/framework itself (the generated half stays, and the vendored
 * half is being deleted).
 */
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sh', '.yml', '.yaml', '.toml'])
// Named rather than "anything starting with a dot": CI lives in `.github`, and
// skipping it is how a workflow keeps running a path that no longer exists.
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'pantry',
  'dist',
  'storage',
  'public',
  'coverage',
  'temp',
  'tmp',
  '.git',
  '.cache',
  '.claude',
  '.idea',
  '.stx',
  '.vscode',
])

async function* projectFiles(cwd: string): AsyncGenerator<string> {
  const walk = async function* (dir: string): AsyncGenerator<string> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    }
    catch {
      return
    }

    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name))
          continue
        yield* walk(full)
        continue
      }

      if (!entry.isFile())
        continue

      const dot = entry.name.lastIndexOf('.')
      const ext = dot === -1 ? '' : entry.name.slice(dot)
      if (SCANNED_EXTENSIONS.has(ext) || entry.name === 'Dockerfile' || entry.name.startsWith('Dockerfile.'))
        yield full
    }
  }

  yield* walk(cwd)
}

/**
 * `…/storage/framework/core/<pkg>/src/<rest>` inside an import specifier.
 *
 * Anchored on the `from` / `import(` / `require(` that precedes it so a path in
 * a comment, a docs snippet or a shell string is left alone — those are
 * reported by `findCoreReferences` instead of silently rewritten into
 * something that reads like code but is not.
 */
const CORE_SOURCE_IMPORT = /(\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])(?:\.{1,2}\/)*storage\/framework\/core\/([\w.-]+)\/src\/([^'"]+?)(?:\.ts)?\2/g

function toPackageSpecifier(pkg: string, rest: string): string {
  const subpath = rest.replace(/\/index$/, '')
  return subpath === 'index' ? `@stacksjs/${pkg}` : `@stacksjs/${pkg}/${subpath}`
}

/**
 * Framework action entrypoints that a project runs as a command, and the buddy
 * command that does the same thing.
 *
 * Deliberately a short, checked list rather than a derived rule: most files
 * under `actions/src` are library code or the framework's own build, and
 * turning one of those into a `./buddy` invocation would produce a command
 * that does not exist. These five are the ones a project's CI, Dockerfile or
 * deploy script actually calls.
 */
const CORE_ACTION_COMMANDS: Record<string, string> = {
  'actions/src/migrate/database': 'migrate',
  'actions/src/migrate/fresh': 'migrate:fresh',
  'actions/src/database/seed': 'seed',
  'actions/src/auth/setup': 'auth:setup',
  'actions/src/dev/api': 'dev:api',
  'actions/src/key-generate': 'key:generate',
}

/**
 * `bun [flags] storage/framework/core/<entry>.ts` — the CLI or an action run as
 * a command. `--conditions=development` and friends are swallowed with the
 * path: they exist to resolve the vendored SOURCE, and the published packages
 * ship no such condition, so carrying them over is noise at best.
 *
 * `bun build … <entry> --outdir …` does not match, because the path has to
 * follow `bun` with nothing but flags in between and `build` is not a flag.
 * That is the behaviour we want: a bundler entrypoint is not a command, and
 * `./buddy` is not a substitute for it. Those surface in the straggler report.
 */
const CORE_COMMAND_PATH = /\bbunx?\s+(?:-{1,2}[\w=.-]+\s+)*(?:\.\/)?storage\/framework\/core\/([\w/.-]+?)\.ts\b/g

export async function rewriteCoreCommandPaths(cwd: string): Promise<string[]> {
  const touched: string[] = []

  for await (const file of projectFiles(cwd)) {
    const raw = await fs.promises.readFile(file, 'utf-8')
    if (!raw.includes('storage/framework/core/'))
      continue

    const next = raw.replace(CORE_COMMAND_PATH, (match, entry: string) => {
      // The CLI itself: the subcommand already follows on the line.
      if (entry === 'buddy/src/cli')
        return './buddy'

      const command = CORE_ACTION_COMMANDS[entry]
      return command ? `./buddy ${command}` : match
    })

    if (next !== raw) {
      await fs.promises.writeFile(file, next)
      touched.push(file.replace(`${cwd}/`, ''))
    }
  }

  return touched
}

export async function rewriteCoreSourceImports(cwd: string): Promise<string[]> {
  const touched: string[] = []

  for await (const file of projectFiles(cwd)) {
    const raw = await fs.promises.readFile(file, 'utf-8')
    if (!raw.includes('storage/framework/core/'))
      continue

    const next = raw.replace(
      CORE_SOURCE_IMPORT,
      (_match, lead: string, quote: string, pkg: string, rest: string) =>
        `${lead}${quote}${toPackageSpecifier(pkg, rest)}${quote}`,
    )

    if (next !== raw) {
      await fs.promises.writeFile(file, next)
      touched.push(file.replace(`${cwd}/`, ''))
    }
  }

  return touched
}

export async function findCoreReferences(cwd: string): Promise<{ file: string, line: number, text: string }[]> {
  const hits: { file: string, line: number, text: string }[] = []

  for await (const file of projectFiles(cwd)) {
    const raw = await fs.promises.readFile(file, 'utf-8')
    if (!raw.includes('storage/framework/core'))
      continue

    raw.split('\n').forEach((text, index) => {
      if (!text.includes('storage/framework/core'))
        return

      const trimmed = text.trim()
      // A prose mention in a comment is not a broken path.
      if (/^(?:\/\/|\*|#|<!--)/.test(trimmed))
        return

      hits.push({ file: file.replace(`${cwd}/`, ''), line: index + 1, text: trimmed.slice(0, 120) })
    })
  }

  return hits
}
