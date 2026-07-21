import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export interface ReleasePackageEntry {
  name: string
  path: string
  version: string
  publishable: boolean
}

export interface ReleaseManifest {
  schemaVersion: '1.0.0'
  repository: string
  tag: string
  tagType: 'annotated' | 'lightweight'
  releaseVersion: string
  releasePackage: string
  sourceRevision: string
  sourceTree: string
  sourceDigest: string
  generatedAt: 'derived-from-immutable-git-objects'
  rootPackage: { name: string, version: string, private: boolean }
  prerequisites: Record<string, string>
  packages: ReleasePackageEntry[]
  policy: {
    tagMatchesReleasePackageVersion: true
    rootVersionIsIndependent: true
    notes: string
  }
}

const root = resolve(import.meta.dir, '../..')
const outputPath = resolve(root, 'protocol/evidence/release-manifest.json')

function runGit(...arguments_: string[]): Buffer {
  try {
    return execFileSync('git', arguments_, { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  }
  catch (error) {
    throw new Error(`git ${arguments_.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function showJson<T>(sourceRevision: string, path: string): T {
  return JSON.parse(runGit('show', `${sourceRevision}:${path}`).toString()) as T
}

function assertReleaseTag(tag: string): string {
  assertReleaseMapping(tag)

  try {
    runGit('show-ref', '--verify', '--quiet', `refs/tags/${tag}`)
  }
  catch {
    throw new Error(`release tag does not exist: ${tag}`)
  }

  return runGit('rev-parse', `refs/tags/${tag}^{commit}`).toString().trim()
}

export function assertReleaseMapping(tag: string, releasePackageVersion?: string): void {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag))
    throw new Error(`release tag must be an exact semantic version tag, received: ${tag}`)

  if (releasePackageVersion !== undefined && releasePackageVersion !== tag.slice(1))
    throw new Error(`release tag ${tag} does not match storage/framework/package.json version ${releasePackageVersion}`)
}

export function buildReleaseManifest(tag: string): ReleaseManifest {
  const sourceRevision = assertReleaseTag(tag)
  const tagObjectType = runGit('cat-file', '-t', `refs/tags/${tag}`).toString().trim()
  const tagType = tagObjectType === 'tag' ? 'annotated' : tagObjectType === 'commit' ? 'lightweight' : null
  if (!tagType)
    throw new Error(`release tag ${tag} points to unsupported Git object type: ${tagObjectType}`)

  const sourceTree = runGit('rev-parse', `${sourceRevision}^{tree}`).toString().trim()
  const treeListing = runGit('ls-tree', '-r', '-l', sourceRevision).toString()
  const paths = treeListing.trim().split('\n').filter(Boolean).flatMap((line): string[] => {
    const match = line.match(/^\d+\s+blob\s+[0-9a-f]+\s+\d+\t(.+)$/)
    return match ? [match[1]] : []
  })
  const packages = paths
    .filter(path => path === 'package.json' || path.endsWith('/package.json'))
    .flatMap((path): ReleasePackageEntry[] => {
      const pkg = showJson<{ name?: string, version?: string, private?: boolean }>(sourceRevision, path)
      if (!pkg.name || !pkg.version) return []
      return [{ name: pkg.name, path, version: pkg.version, publishable: pkg.private !== true }]
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path))

  const rootPackage = showJson<{ name: string, version: string, private?: boolean, system?: Record<string, string> }>(sourceRevision, 'package.json')
  const releasePackagePath = 'storage/framework/package.json'
  const releasePackage = packages.find(pkg => pkg.path === releasePackagePath)
  if (!releasePackage)
    throw new Error(`${releasePackagePath} is missing a name or version at ${sourceRevision}`)

  const releaseVersion = tag.slice(1)
  assertReleaseMapping(tag, releasePackage.version)

  return {
    schemaVersion: '1.0.0',
    repository: 'https://github.com/stacksjs/stacks',
    tag,
    tagType,
    releaseVersion,
    releasePackage: releasePackage.name,
    sourceRevision,
    sourceTree,
    sourceDigest: `sha256:${createHash('sha256').update(treeListing).digest('hex')}`,
    generatedAt: 'derived-from-immutable-git-objects',
    rootPackage: {
      name: rootPackage.name,
      version: rootPackage.version,
      private: rootPackage.private === true,
    },
    prerequisites: rootPackage.system || {},
    packages,
    policy: {
      tagMatchesReleasePackageVersion: true,
      rootVersionIsIndependent: true,
      notes: 'The release tag versions stacks-framework. The private root package orchestrates the monorepo and has an independent version. Every versioned package is recorded at the exact tagged commit.',
    },
  }
}

export function renderReleaseManifest(manifest: ReleaseManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

if (import.meta.main) {
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null
  if (!mode) {
    console.error('usage: bun scripts/protocol/release-manifest.ts --write --tag <tag> | --check')
    process.exit(2)
  }

  if (mode === 'write') {
    const index = process.argv.indexOf('--tag')
    const tag = index === -1 ? null : process.argv[index + 1]
    if (!tag) throw new Error('--tag requires an exact release tag')
    const manifest = buildReleaseManifest(tag)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, renderReleaseManifest(manifest))
    console.log(`Wrote release manifest for ${manifest.tag} at ${manifest.sourceRevision} (${manifest.packages.length} packages)`)
  }
  else {
    if (!existsSync(outputPath)) throw new Error('release manifest is missing; run bun run protocol:release -- --tag <tag>')
    const current = JSON.parse(readFileSync(outputPath, 'utf8')) as ReleaseManifest
    const expected = renderReleaseManifest(buildReleaseManifest(current.tag))
    if (readFileSync(outputPath, 'utf8') !== expected)
      throw new Error(`release manifest is stale or modified; run bun run protocol:release -- --tag ${current.tag}`)
    console.log(`Release manifest matches ${current.tag} at ${current.sourceRevision}`)
  }
}
