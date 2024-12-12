import type { JsonFile, PackageJson, TextFile } from '@stacksjs/types'
import { contains } from '@stacksjs/arrays'
import { log } from '@stacksjs/logging'
import { dirname, join, path as p } from '@stacksjs/path'
import { detectIndent, detectNewline } from '@stacksjs/strings'
import { createFolder, isFolder } from './'
import { existsSync, fs } from './fs'

/**
 * Reads a JSON file and returns the parsed data.
 */
export async function readJsonFile(name: string, cwd?: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)
  const data = JSON.parse(file.data)
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
  return !isFile(path) || !isFolder(path)
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

export function deleteFiles(dir: string, exclude: string[] = []): void {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const p = join(dir, file)
      if (fs.statSync(p).isDirectory()) {
        if (fs.readdirSync(p).length === 0)
          fs.rmSync(p, { recursive: true, force: true })
        else deleteFiles(p, exclude)
      }
      else if (!contains(p, exclude)) {
        fs.rmSync(p)
      }
    })
  }
}

export function getFiles(dir: string, exclude: string[] = []): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)

  list.forEach((file) => {
    file = join(dir, file)
    const stat = fs.statSync(file)

    if (stat.isDirectory())
      results = results.concat(getFiles(file, exclude))
    else if (!contains(file, exclude))
      results.push(file)
  })

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
