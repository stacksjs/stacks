import { fileURLToPath } from 'node:url'
import { copyFileSync, existsSync, mkdirSync, readFile, readdirSync, rmSync, statSync, writeFile } from 'node:fs'
import { dirname, join, resolve } from 'pathe'
import detectIndent from 'detect-indent'
import { detectNewline } from 'detect-newline'
import { contains } from './array'

/**
 * Describes a plain-text file.
 */
export interface TextFile {
  path: string
  data: string
}

/**
 * Describes a JSON file.
 */
interface JsonFile {
  path: string
  data: unknown
  indent: string
  newline: string | undefined
}

/**
 * Reads a JSON file and returns the parsed data.
 */
export async function readJsonFile(name: string, cwd: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)
  const data = JSON.parse(file.data) as unknown
  const indent = detectIndent(file.data).indent
  const newline = detectNewline(file.data)

  return { ...file, data, indent, newline }
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
export function readTextFile(name: string, cwd: string): Promise<TextFile> {
  return new Promise((resolve, reject) => {
    const filePath = join(cwd, name)

    readFile(filePath, 'utf8', (err, text) => {
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
    writeFile(file.path, file.data, (err: any) => {
      if (err)
        reject(err)

      else
        resolve()
    })
  })
}

/**
 * Determine whether a path is a folder.
 */
export function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

/**
 * Determine whether a path is a file.
 */
export function isFile(path: string): boolean {
  return existsSync(path)
}

/**
 * Determine whether a folder has any files in it.
 */
export function hasFiles(folder: string): boolean {
  return readdirSync(folder).length > 0
}

export function hasComponents(): boolean {
  return hasFiles(resolve(process.cwd(), './components'))
}

export function hasFunctions(): boolean {
  return hasFiles(resolve(process.cwd(), './functions'))
}

export function copyFolder(src: string, dest: string, pathsToExclude?: string[]): void {
  if (!existsSync(dest))
    mkdirSync(dest, { recursive: true })

  if (existsSync(src)) {
    readdirSync(src).forEach((file) => {
      if (!contains(join(src, file), pathsToExclude as string[])) {
        const srcPath = join(src, file)
        const destPath = join(dest, file)

        if (statSync(srcPath).isDirectory())
          copyFolder(srcPath, destPath, pathsToExclude)

        else
          copyFileSync(srcPath, destPath)
      }
    })
  }
}

export const deleteFolder = async (path: string) => {
  await rmSync(path, { recursive: true, force: true })
}

export const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))
