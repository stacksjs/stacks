import type { JsonFile, TextFile, PackageJson } from '@stacksjs/types'
import { fs } from "./fs";
import { detectIndent, detectNewline } from '@stacksjs/strings'
import { componentsPath, functionsPath, projectPath, join, dirname } from '@stacksjs/path'
import { contains } from '@stacksjs/arrays'

/**
 * Reads a JSON file and returns the parsed data.
 */
export async function readJsonFile(name: string, cwd?: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)
  const data = JSON.parse(file.data) as unknown
  const indent = detectIndent(file.data).indent
  const newline = detectNewline(file.data)

  return { ...file, data, indent, newline }
}

/**
 * Reads a package.json file and returns the parsed data.
 */
export async function readPackageJson(name: string, cwd?: string) {
  const file = await readJsonFile(name, cwd)
  const data = file.data as PackageJson

  return data
}

/**
 * Writes the given data to the specified JSON file.
 */
export async function writeJsonFile(file: JsonFile): Promise<void> {
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
    else
      filePath = name

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
export function writeTextFile(file: TextFile): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(file.path, file.data, (err: any) => {
      if (err)
        reject(err)

      else
        resolve()
    })
  })
}

/**
 * Determine whether a path is a file.
 */
export function isFile(path: string): boolean {
  return fs.existsSync(projectPath(path))
}

/**
 * Determine whether a folder has any files in it.
 */
export function hasFiles(folder: string): boolean {
  return fs.readdirSync(folder).length > 0
}

export function hasComponents(): boolean {
  return hasFiles(componentsPath())
}

export function hasFunctions(): boolean {
  return hasFiles(functionsPath())
}

export function deleteFiles(dir: string, exclude: string[] = []) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const p = join(dir, file)
      if (fs.statSync(p).isDirectory()) {
        if (fs.readdirSync(p).length === 0)
          fs.rmSync(p, { recursive: true, force: true })

        else
          deleteFiles(p, exclude)
      }

      else if (!contains(p, exclude)) { fs.rmSync(p) }
    })
  }
}

export function getFiles(dir: string, exclude: string[] = []): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)

  list.forEach((file) => {
    file = join(dir, file)
    const stat = fs.statSync(file)

    if (stat && stat.isDirectory())
      results = results.concat(getFiles(file, exclude))

    else if (!contains(file, exclude))
      results.push(file)
  })

  return results
}

export function put(path: string, contents: string) {
  const dirPath = dirname(path);

  if (!fs.existsSync(dirPath))
    fs.mkdirSync(dirPath, { recursive: true })

  fs.writeFileSync(path, contents, 'utf-8')
}

export async function get(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, text) => {
      if (err)
        reject(err)

      else
        resolve(text)
    })
  })
}
