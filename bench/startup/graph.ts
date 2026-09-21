import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { isSafePortableRelativePath } from '../artifact-files'

export interface BuiltGraphFile {
  bytes: number
  path: string
  sha256: string
}

export interface BuiltGraph {
  digest: string
  fileCount: number
  files: BuiltGraphFile[]
  totalBytes: number
}

function sha256(value: string | Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

export function summarizeBuiltGraph(files: readonly BuiltGraphFile[]): BuiltGraph {
  const ordered = [...files].sort((left, right) => left.path.localeCompare(right.path))
  const digestInput = ordered.map(file => `${file.path}\0${file.bytes}\0${file.sha256}`).join('\n')
  return {
    digest: sha256(digestInput),
    files: ordered,
    fileCount: ordered.length,
    totalBytes: ordered.reduce((sum, file) => sum + file.bytes, 0),
  }
}

export function validateBuiltGraph(graph: BuiltGraph, label: string): void {
  if (!graph || !Array.isArray(graph.files) || graph.files.length === 0)
    throw new Error(`${label} has no retained built files`)
  for (const file of graph.files) {
    if (!isSafePortableRelativePath(file.path) || extname(file.path) !== '.js')
      throw new Error(`${label} contains an invalid built-file path`)
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0)
      throw new Error(`${label} contains an invalid built-file size`)
    if (!/^[a-f\d]{64}$/.test(file.sha256))
      throw new Error(`${label} contains an invalid built-file SHA-256`)
  }
  const paths = graph.files.map(file => file.path)
  if (new Set(paths).size !== paths.length)
    throw new Error(`${label} contains duplicate built-file paths`)
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right))
  if (paths.some((path, index) => path !== sortedPaths[index]))
    throw new Error(`${label} built-file paths are not sorted`)

  const expected = summarizeBuiltGraph(graph.files)
  if (graph.fileCount !== expected.fileCount || graph.totalBytes !== expected.totalBytes || graph.digest !== expected.digest)
    throw new Error(`${label} summary does not match its retained built files`)
}

function assertInside(root: string, path: string): void {
  const fromRoot = relative(root, path)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot))
    throw new Error(`Built graph import escapes its root: ${path}`)
}

function resolveLocalImport(importer: string, specifier: string, root: string): string {
  const unresolved = resolve(dirname(importer), specifier)
  assertInside(root, unresolved)
  const candidates = [unresolved, `${unresolved}.js`, resolve(unresolved, 'index.js')]
  const match = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile())
  if (!match)
    throw new Error(`Cannot resolve local built import ${specifier} from ${relative(root, importer)}`)
  if (extname(match) !== '.js')
    throw new Error(`Built graph contains a non-JavaScript local import: ${relative(root, match)}`)
  const canonical = realpathSync(match)
  assertInside(root, canonical)
  return canonical
}

export async function readBuiltGraph(entry: string, graphRoot: string): Promise<BuiltGraph> {
  if (!existsSync(entry) || !statSync(entry).isFile())
    throw new Error(`Missing built entry: ${entry}`)

  const root = realpathSync(graphRoot)
  const initial = realpathSync(entry)
  assertInside(root, initial)
  const transpiler = new Bun.Transpiler({ loader: 'js' })
  const pending = [initial]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const file = pending.pop()!
    if (visited.has(file)) continue
    visited.add(file)
    const source = await Bun.file(file).text()
    for (const imported of transpiler.scanImports(source)) {
      if (imported.path.startsWith('.'))
        pending.push(resolveLocalImport(file, imported.path, root))
    }
  }

  const files = await Promise.all([...visited].sort().map(async (file) => {
    const contents = new Uint8Array(await Bun.file(file).arrayBuffer())
    return {
      path: relative(root, file),
      bytes: contents.byteLength,
      sha256: sha256(contents),
    }
  }))
  return summarizeBuiltGraph(files)
}
