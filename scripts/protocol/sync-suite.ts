import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'

interface SuiteLock {
  protocolVersion: string
  rfcsRevision: string
  sourceRepository: string
  files: Record<string, string>
}

const root = resolve(import.meta.dir, '../..')
const suiteRoot = resolve(root, 'protocol/suite/1.0-draft')
const lockPath = resolve(root, 'protocol/suite.lock.json')

function digest(data: Buffer | string): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path) : [path]
  }).sort()
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function gitRevision(repository: string): string {
  const result = Bun.spawnSync(['git', '-C', repository, 'rev-parse', 'HEAD'])
  if (result.exitCode !== 0)
    throw new Error(`Could not resolve the RFC repository revision: ${result.stderr.toString().trim()}`)
  return result.stdout.toString().trim()
}

function writeSnapshot(sourceRepository: string): void {
  const sourceRoot = resolve(sourceRepository, 'protocol/1.0-draft')
  if (!existsSync(resolve(sourceRoot, 'catalog.json')))
    throw new Error(`No protocol suite found at ${sourceRoot}`)

  rmSync(suiteRoot, { force: true, recursive: true })
  const files: Record<string, string> = {}
  const sourceFiles = [
    ...filesBelow(sourceRoot).map(sourcePath => ({ sourcePath, path: relative(sourceRoot, sourcePath) })),
    ...['LICENSE-SPECIFICATION.md', 'LICENSE-FIXTURES.md'].map(path => ({ sourcePath: resolve(sourceRepository, path), path })),
  ]
  for (const { sourcePath, path } of sourceFiles) {
    const outputPath = resolve(suiteRoot, path)
    const contents = readFileSync(sourcePath)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, contents)
    files[path] = digest(contents)
  }

  const lock: SuiteLock = {
    protocolVersion: '1.0-draft',
    rfcsRevision: gitRevision(sourceRepository),
    sourceRepository: 'https://github.com/stacksjs/rfcs',
    files,
  }
  mkdirSync(dirname(lockPath), { recursive: true })
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  console.log(`Pinned ${Object.keys(files).length} protocol files at ${lock.rfcsRevision}`)
}

function checkSnapshot(): void {
  if (!existsSync(lockPath)) throw new Error('protocol/suite.lock.json is missing; run bun run protocol:sync')
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as SuiteLock
  if (!/^[0-9a-f]{40}$/.test(lock.rfcsRevision)) throw new Error('suite lock has an invalid RFC revision')

  const actualFiles = filesBelow(suiteRoot).map(path => relative(suiteRoot, path))
  const expectedFiles = Object.keys(lock.files).sort()
  const unexpected = actualFiles.filter(path => !lock.files[path])
  const missing = expectedFiles.filter(path => !actualFiles.includes(path))
  const changed = expectedFiles.filter((path) => {
    const absolutePath = resolve(suiteRoot, path)
    return existsSync(absolutePath) && digest(readFileSync(absolutePath)) !== lock.files[path]
  })
  const errors = [
    ...missing.map(path => `missing: ${path}`),
    ...unexpected.map(path => `unexpected: ${path}`),
    ...changed.map(path => `modified: ${path}`),
  ]
  if (errors.length > 0)
    throw new Error(`Vendored protocol suite does not match its lock:\n${errors.join('\n')}`)
  console.log(`Protocol suite matches ${basename(lock.sourceRepository)}@${lock.rfcsRevision} (${actualFiles.length} files)`)
}

/** Requirement ids that appear more than once in `ids` (sorted, deduped). */
export function duplicateRequirementIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id))
      duplicates.add(id)
    else
      seen.add(id)
  }
  return [...duplicates].sort()
}

/**
 * Validate the vendored requirement catalog: every requirement carries a
 * non-empty string id and those ids are unique. Protocol 1.0 ratification
 * requires requirement ids to be unique and validated in CI
 * (stacksjs/stacks#2050); the vendored `catalog.json` had no such check, so a
 * duplicate id sneaking in from the RFC source would go unnoticed.
 */
function checkCatalog(): void {
  const catalogPath = resolve(suiteRoot, 'catalog.json')
  if (!existsSync(catalogPath))
    throw new Error(`protocol catalog missing at ${relative(root, catalogPath)}; run bun run protocol:sync`)

  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as { requirements?: Array<{ id?: unknown }> }
  const requirements = Array.isArray(catalog.requirements) ? catalog.requirements : []
  if (requirements.length === 0)
    throw new Error('protocol catalog has no requirements')

  const ids = requirements.map(requirement => requirement?.id)
  const missing = ids.filter(id => typeof id !== 'string' || id.length === 0).length
  if (missing > 0)
    throw new Error(`protocol catalog has ${missing} requirement(s) without a string id`)

  const duplicates = duplicateRequirementIds(ids as string[])
  if (duplicates.length > 0)
    throw new Error(`protocol catalog has duplicate requirement id(s): ${duplicates.join(', ')}`)

  console.log(`Protocol catalog: ${ids.length} requirement ids, all unique`)
}

if (import.meta.main) {
  if (process.argv.includes('--write')) {
    const source = resolve(argument('--source') || process.env.STACKS_RFC_SOURCE || resolve(root, '../rfcs'))
    writeSnapshot(source)
  }
  else if (process.argv.includes('--check')) {
    checkSnapshot()
    checkCatalog()
  }
  else {
    console.error('usage: bun scripts/protocol/sync-suite.ts --write [--source ../rfcs] | --check')
    process.exit(2)
  }
}
