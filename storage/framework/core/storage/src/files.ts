import type { JsonFile, PackageJson, TextFile } from '@stacksjs/types'
import { contains } from '@stacksjs/arrays'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { dirname, join, resolve, relative, isAbsolute, parse, sep } from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { detectIndent, detectNewline } from '@stacksjs/strings'
import { createFolder, isFolder } from './folders'
import { existsSync, fs } from './fs'

/**
 * Reads a JSON file and returns the parsed data.
 */
export async function readJsonFile(name: string, cwd?: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)

  let data: unknown
  try {
    data = JSON.parse(file.data)
  }
  catch (error) {
    throw new Error(`Failed to parse JSON file "${name}": ${(error as Error).message}`)
  }

  const indent = detectIndent(file.data).indent
  const newline = detectNewline(file.data)

  return { ...file, data, indent, newline }
}

/**
 * Reads a package.json file and returns the parsed data.
 */
export async function readPackageJson(name: string, cwd?: string): Promise<PackageJson> {
  const file = await readJsonFile(name, cwd)
  return file.data as PackageJson
}

/**
 * Writes the given text to the specified file.
 */
export async function writeFile(path: string, data: any): Promise<number> {
  // export async function writeFile(path: Path, data: Data): Promise<number> {
  if (typeof path === 'string') {
    const dirPath = dirname(path)
    if (!(await existsSync(dirPath)))
      await createFolder(dirPath)

    return await Bun.write(Bun.file(path), data)
  }

  return await Bun.write(path, data)
}

/**
 * Writes the given data to the specified JSON file.
 */
export async function writeJsonFile(file: JsonFile): Promise<number> {
  let json = JSON.stringify(file.data, undefined, file.indent)

  if (file.newline)
    json += file.newline

  return writeTextFile({ ...file, data: json })
}

/**
 * Reads a text file and returns its contents.
 */
export function readTextFile(name: string, cwd?: string): Promise<TextFile> {
  return new Promise((resolve, reject) => {
    let filePath: string

    if (cwd)
      filePath = join(cwd, name)
    else filePath = name

    fs.readFile(filePath, 'utf8', (err, text) => {
      if (err) {
        reject(err)
      }
      else {
        resolve({
          path: filePath,
          data: text,
        })
      }
    })
  })
}

/**
 * Writes the given text to the specified file.
 */
export async function writeTextFile(file: TextFile): Promise<number> {
  return await Bun.write(file.path, file.data)
}

/**
 * Determine whether a path exists.
 */
function isFile(path: string): boolean {
  return fs.existsSync(path)
}

export function doesExist(path: string): boolean {
  return isFile(path) || isFolder(path)
}

export function doesNotExist(path: string): boolean {
  return !isFile(path) && !isFolder(path)
}

/**
 * Determine whether a folder has any files in it.
 */
export function hasFiles(folder: string): boolean {
  try {
    return fs.readdirSync(folder).length > 0
  }
  catch (err) {
    log.debug(`Error reading folder: ${folder}`, err)
    return false
  }
}

export function hasComponents(): boolean {
  return hasFiles(p.componentsPath())
}

export function hasFunctions(): boolean {
  return hasFiles(p.functionsPath())
}

/** Accept platform aliases above cwd/temp anchors, never symlinks below them. */
function traversalRoot(directory: string): string {
  const root = resolve(directory)
  const anchors = [process.cwd(), tmpdir(), ...(process.platform === 'win32' ? [] : ['/tmp'])]
  const candidates = anchors.flatMap(anchor => {
    try { return [resolve(anchor), fs.realpathSync(anchor)] }
    catch { return [resolve(anchor)] }
  })
  const contained = (anchor: string) => {
    const part = relative(anchor, root)
    return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`))
  }
  const anchor = candidates.filter(contained).sort((a, b) => b.length - a.length)[0] ?? parse(root).root
  let current = anchor
  for (const part of (root === anchor ? [] : relative(anchor, dirname(root)).split(sep).filter(Boolean))) {
    current = join(current, part)
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Cannot traverse a symlink ancestor: ${current}`)
  }
  return root
}

/** Delete files and link entries, never the contents of a symlink target. */
export function deleteFiles(dir: string, exclude: string[] = []): void {
  if (contains(dir, exclude)) return
  let root: string
  try { root = traversalRoot(dir) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  const walk = (path: string, display: string): void => {
    if (contains(display, exclude)) return
    let stat: ReturnType<typeof fs.lstatSync>
    try { stat = fs.lstatSync(path) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (!stat.isDirectory()) { fs.unlinkSync(path); return }
    for (const name of fs.readdirSync(path)) {
      const entry = join(path, name), shown = join(display, name)
      if (contains(shown, exclude)) continue
      const child = fs.lstatSync(entry)
      if (child.isDirectory() && fs.readdirSync(entry).length === 0) fs.rmdirSync(entry)
      else walk(entry, shown)
    }
  }
  walk(root, dir)
}

/** List ordinary files without following root or descendant symlink entries. */
export function getFiles(dir: string, exclude: string[] = []): string[] {
  const root = traversalRoot(dir)
  if (fs.lstatSync(root).isSymbolicLink() || contains(dir, exclude)) return []
  const results: string[] = []
  const walk = (path: string, display: string): void => {
    for (const name of fs.readdirSync(path)) {
      const file = join(path, name), shown = join(display, name)
      if (contains(shown, exclude)) continue
      const stat = fs.lstatSync(file)
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) walk(file, shown)
      else if (stat.isFile()) results.push(shown)
    }
  }
  walk(root, dir)
  return results
}

export function put(path: string, contents: string): void {
  const dirPath = dirname(path)

  if (!fs.existsSync(dirPath))
    fs.mkdirSync(dirPath, { recursive: true })

  fs.writeFileSync(path, contents, 'utf-8')
}

export async function get(path: string): Promise<string> {
  return Bun.file(path).text()
}

export interface Files {
  readJsonFile: typeof readJsonFile
  readPackageJson: typeof readPackageJson
  readTextFile: typeof readTextFile
  writeJsonFile: typeof writeJsonFile
  writeTextFile: typeof writeTextFile
  hasFiles: typeof hasFiles
  hasComponents: typeof hasComponents
  hasFunctions: typeof hasFunctions
  deleteFiles: typeof deleteFiles
  getFiles: typeof getFiles
  put: typeof put
  get: typeof get
}

export const files: Files = {
  readJsonFile,
  readPackageJson,
  readTextFile,
  writeJsonFile,
  writeTextFile,
  hasFiles,
  hasComponents,
  hasFunctions,
  deleteFiles,
  getFiles,
  put,
  get,
}
