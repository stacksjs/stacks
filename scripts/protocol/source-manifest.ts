import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

interface PackageEntry { name: string, path: string, version: string, publishable: boolean }
interface SourceManifest {
  schemaVersion: '1.0.0'
  repository: string
  sourceRevision: string
  sourceTree: string
  sourceDigest: string
  generatedAt: string
  classification: {
    status: 'reference-implementation'
    conformance: 'unverified'
    notes: string
  }
  prerequisites: Record<string, string>
  packages: PackageEntry[]
  inventory: {
    totalFiles: number
    totalBytes: number
    categories: Record<string, { files: number, bytes: number }>
    extensions: Record<string, number>
  }
  protocolSuite: { version: string, rfcsRevision: string }
}

const root = resolve(import.meta.dir, '../..')
const outputPath = resolve(root, 'protocol/evidence/source-manifest.json')

function runGit(...arguments_: string[]): Buffer {
  try {
    return execFileSync('git', arguments_, { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  }
  catch (error) {
    throw new Error(`git ${arguments_.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function revision(value: string): string {
  return runGit('rev-parse', `${value}^{commit}`).toString().trim()
}

function showJson<T>(sourceRevision: string, path: string): T {
  return JSON.parse(runGit('show', `${sourceRevision}:${path}`).toString()) as T
}

function category(path: string): string {
  if (/(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/.test(path)) return 'tests'
  if (path.startsWith('protocol/suite/')) return 'vendored-protocol'
  if (/(^|\/)(dist|generated|coverage)(\/|$)|\.d\.ts$/.test(path)) return 'generated'
  if (/\.(md|mdx|rst|txt)$/.test(path) || /(^|\/)docs\//.test(path)) return 'documentation'
  if (/(^|\/)(config|configs|\.github)(\/|$)|(^|\/)(tsconfig|package|bun\.lock|pantry)\b/.test(path)) return 'configuration'
  if (/\.(ts|tsx|js|jsx|vue|svelte|zig|rs|go|py|sh)$/.test(path)) return 'source'
  return 'assets-and-data'
}

function addCount(record: Record<string, { files: number, bytes: number }>, key: string, bytes: number): void {
  const current = record[key] || { files: 0, bytes: 0 }
  record[key] = { files: current.files + 1, bytes: current.bytes + bytes }
}

export function buildSourceManifest(requestedRevision: string): SourceManifest {
  const sourceRevision = revision(requestedRevision)
  const sourceTree = runGit('rev-parse', `${sourceRevision}^{tree}`).toString().trim()
  const treeListing = runGit('ls-tree', '-r', '-l', sourceRevision).toString()
  const lines = treeListing.trim().split('\n').filter(Boolean)
  const categories: Record<string, { files: number, bytes: number }> = {}
  const extensions: Record<string, number> = {}
  let totalBytes = 0
  const paths: string[] = []

  for (const line of lines) {
    const match = line.match(/^\d+\s+blob\s+[0-9a-f]+\s+(\d+)\t(.+)$/)
    if (!match) continue
    const bytes = Number(match[1])
    const path = match[2]
    paths.push(path)
    totalBytes += bytes
    addCount(categories, category(path), bytes)
    const extension = extname(path).toLowerCase() || '[none]'
    extensions[extension] = (extensions[extension] || 0) + 1
  }

  const packages = paths.filter(path => path === 'package.json' || path.endsWith('/package.json')).flatMap((path): PackageEntry[] => {
    const pkg = showJson<{ name?: string, version?: string, private?: boolean }>(sourceRevision, path)
    if (!pkg.name || !pkg.version) return []
    return [{ name: pkg.name, path, version: pkg.version, publishable: pkg.private !== true }]
  }).sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path))
  const rootPackage = showJson<{ system?: Record<string, string> }>(sourceRevision, 'package.json')
  const suiteLock = showJson<{ protocolVersion: string, rfcsRevision: string }>(sourceRevision, 'protocol/suite.lock.json')

  return {
    schemaVersion: '1.0.0',
    repository: 'https://github.com/stacksjs/stacks',
    sourceRevision,
    sourceTree,
    sourceDigest: `sha256:${createHash('sha256').update(treeListing).digest('hex')}`,
    generatedAt: 'derived-from-immutable-git-objects',
    classification: {
      status: 'reference-implementation',
      conformance: 'unverified',
      notes: 'Reference implementation status does not imply a protocol profile claim; consult the report for per-requirement evidence.',
    },
    prerequisites: rootPackage.system || {},
    packages,
    inventory: {
      totalFiles: lines.length,
      totalBytes,
      categories: Object.fromEntries(Object.entries(categories).sort(([a], [b]) => a.localeCompare(b))),
      extensions: Object.fromEntries(Object.entries(extensions).sort(([a], [b]) => a.localeCompare(b))),
    },
    protocolSuite: { version: suiteLock.protocolVersion, rfcsRevision: suiteLock.rfcsRevision },
  }
}

function render(manifest: SourceManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

if (import.meta.main) {
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null
  if (!mode) {
    console.error('usage: bun scripts/protocol/source-manifest.ts --write [--revision <ref>] | --check')
    process.exit(2)
  }

  if (mode === 'write') {
    const index = process.argv.indexOf('--revision')
    const requestedRevision = index === -1 ? 'HEAD' : process.argv[index + 1]
    if (!requestedRevision) throw new Error('--revision requires a Git ref')
    const manifest = buildSourceManifest(requestedRevision)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, render(manifest))
    console.log(`Wrote source manifest for ${manifest.sourceRevision} (${manifest.inventory.totalFiles} files, ${manifest.packages.length} packages)`)
  }
  else {
    if (!existsSync(outputPath)) throw new Error('source manifest is missing; run bun run protocol:manifest')
    const current = JSON.parse(readFileSync(outputPath, 'utf8')) as SourceManifest
    const expected = render(buildSourceManifest(current.sourceRevision))
    if (readFileSync(outputPath, 'utf8') !== expected)
      throw new Error(`source manifest is stale or modified; run bun scripts/protocol/source-manifest.ts --write --revision ${current.sourceRevision}`)
    console.log(`Source manifest matches ${current.sourceRevision}`)
  }
}
