import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export interface SourceSnapshot {
  dirty: boolean
  fingerprint: string
  revision: string
}

interface PackageManifest {
  dependencies?: Record<string, string>
  name?: string
  version?: string
}

async function command(cwd: string, args: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).bytes(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0)
    throw new Error(`${args.join(' ')} failed: ${stderr.trim()}`)
  return stdout
}

function updateChunk(hasher: Bun.CryptoHasher, label: string, bytes: Uint8Array): void {
  hasher.update(label)
  hasher.update(new Uint8Array([0]))
  hasher.update(bytes)
  hasher.update(new Uint8Array([0]))
}

export async function readSourceSnapshot(repositoryRoot: string): Promise<SourceSnapshot> {
  const revision = new TextDecoder().decode(await command(repositoryRoot, ['git', 'rev-parse', '--verify', 'HEAD'])).trim()
  if (!/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(revision))
    throw new Error(`Git returned an invalid source revision: ${revision}`)

  const [status, diff, untrackedOutput] = await Promise.all([
    command(repositoryRoot, ['git', 'status', '--porcelain=v1', '--untracked-files=all']),
    command(repositoryRoot, ['git', 'diff', '--binary', 'HEAD']),
    command(repositoryRoot, ['git', 'ls-files', '--others', '--exclude-standard', '-z']),
  ])
  const untracked = new TextDecoder().decode(untrackedOutput).split('\0').filter(Boolean).sort()
  const hasher = new Bun.CryptoHasher('sha256')
  updateChunk(hasher, 'revision', new TextEncoder().encode(revision))
  updateChunk(hasher, 'status', status)
  updateChunk(hasher, 'diff', diff)
  for (const path of untracked)
    updateChunk(hasher, `untracked:${path}`, new Uint8Array(await Bun.file(join(repositoryRoot, path)).arrayBuffer()))

  return {
    revision,
    dirty: status.byteLength > 0,
    fingerprint: hasher.digest('hex'),
  }
}

async function findPackageManifest(entry: string): Promise<{ manifest: PackageManifest, path: string }> {
  let directory = dirname(entry)
  while (dirname(directory) !== directory) {
    const path = join(directory, 'package.json')
    if (existsSync(path))
      return { manifest: await Bun.file(path).json(), path }
    directory = dirname(directory)
  }
  throw new Error(`Could not locate the package manifest for ${entry}`)
}

export async function readPackageProvenance(packageRoot: string): Promise<object> {
  const packageManifestPath = join(packageRoot, 'package.json')
  const manifest: PackageManifest = await Bun.file(packageManifestPath).json()
  const bunRouterEntry = await Bun.resolve('@stacksjs/bun-router', packageRoot)
  const bunRouter = await findPackageManifest(bunRouterEntry)
  return {
    frameworkRouter: {
      name: manifest.name,
      version: manifest.version,
      manifest: basename(packageManifestPath),
    },
    bunRouter: {
      name: bunRouter.manifest.name,
      version: bunRouter.manifest.version,
      declaredRange: manifest.dependencies?.['@stacksjs/bun-router'],
      resolvedEntry: bunRouterEntry,
      manifest: bunRouter.path,
    },
  }
}
