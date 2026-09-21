import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

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
  const digestInput = files.map(file => `${file.path}\0${file.bytes}\0${file.sha256}`).join('\n')
  return {
    digest: sha256(digestInput),
    files,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  }
}
