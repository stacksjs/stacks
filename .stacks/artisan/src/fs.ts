import { copyFileSync, existsSync, mkdirSync, readFile, readdirSync, rmSync, statSync, writeFile } from 'fs-extra'
import { join } from 'pathe'
import detectIndent from 'detect-indent'
import { detectNewline } from 'detect-newline'
import type { JsonFile, TextFile } from './types'

/**
 * Determine whether a path is a file.
 */
export function isFile(path: string): boolean {
  return existsSync(path)
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
 * Reads a JSON file and returns the parsed data.
 */
export async function readJsonFile(name: string, cwd: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)
  const data = JSON.parse(file.data) as unknown
  const indent = detectIndent(file.data).indent
  const newline = detectNewline(file.data)

  return { ...file, data, indent, newline }
}

export const copyFiles = async (src: string, dest: string) => {
  if (!existsSync(src))
    return

  if (statSync(src).isDirectory()) {
    if (!existsSync(dest))
      mkdirSync(dest, { recursive: true })

    const pathsToExclude = ['node_modules', 'functions/package.json', 'components/package.json', 'web-components/package.json', 'auto-imports.d.ts', 'components.d.ts']

    readdirSync(src).forEach((file) => {
      if (contains(file, pathsToExclude)) // no need to copy node_modules & package.json
        copyFiles(join(src, file), join(dest, file))
    })

    return
  }

  copyFileSync(src, dest)
}

export const deleteFolder = async (path: string) => {
  await rmSync(path, { recursive: true, force: true })
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
 * Determine whether a folder has any files in it.
 */
export function hasFiles(folder: string): boolean {
  return readdirSync(folder).length > 0
}
