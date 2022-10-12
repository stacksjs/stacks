import { fileURLToPath } from 'node:url'
import { copyFileSync, existsSync, mkdirSync, readFile, readdirSync, rmSync, statSync, writeFile } from 'node:fs'
import { dirname, join } from 'pathe'
import detectIndent from 'detect-indent'
import { detectNewline } from 'detect-newline'
import type { JsonFile, TextFile } from '../types'
import { componentsPath, functionsPath, projectPath } from './helpers'
import { contains } from './array'

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
  return existsSync(projectPath(path))
}

/**
 * Determine whether a folder has any files in it.
 */
export function hasFiles(folder: string): boolean {
  return readdirSync(folder).length > 0
}

export function hasComponents(): boolean {
  return hasFiles(componentsPath())
}

export function hasFunctions(): boolean {
  return hasFiles(functionsPath())
}

export function copyFolder(src: string, dest: string, exclude: string[] = []): void {
  if (!existsSync(dest))
    mkdirSync(dest, { recursive: true })

  if (existsSync(src)) {
    readdirSync(src).forEach((file) => {
      if (!contains(join(src, file), exclude)) {
        const srcPath = join(src, file)
        const destPath = join(dest, file)

        if (statSync(srcPath).isDirectory())
          copyFolder(srcPath, destPath, exclude)

        else
          copyFileSync(srcPath, destPath)
      }
    })
  }
}

export async function deleteFolder(path: string) {
  if (statSync(path).isDirectory())
    await rmSync(path, { recursive: true, force: true })
}

export function deleteFiles(dir: string, exclude: string[] = []) {
  if (existsSync(dir)) {
    readdirSync(dir).forEach((file) => {
      const path = join(dir, file)
      if (statSync(path).isDirectory()) {
        if (readdirSync(path).length === 0)
          rmSync(path, { recursive: true, force: true })

        else
          deleteFiles(path, exclude)
      }

      else if (!contains(path, exclude)) { rmSync(path) }
    })
  }
}

export function deleteEmptyFolders(dir: string) {
  if (existsSync(dir)) {
    readdirSync(dir).forEach((file) => {
      const path = join(dir, file)
      if (statSync(path).isDirectory()) {
        if (readdirSync(path).length === 0)
          rmSync(path, { recursive: true, force: true })

        else deleteEmptyFolders(path)
      }
    })
  }
}

export function doesFolderExist(path: string) {
  return existsSync(path)
}

export const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))
