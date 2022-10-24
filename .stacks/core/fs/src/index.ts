import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import detectIndent from 'detect-indent'
import { detectNewline } from 'detect-newline'
import type { JsonFile, TextFile } from '@stacksjs/types'
import path from '@stacksjs/path'
import { contains } from '@stacksjs/arrays'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url))

/**
 * Reads a JSON file and returns the parsed data.
 */
async function readJsonFile(name: string, cwd: string): Promise<JsonFile> {
  const file = await readTextFile(name, cwd)
  const data = JSON.parse(file.data) as unknown
  const indent = detectIndent(file.data).indent
  const newline = detectNewline(file.data)

  return { ...file, data, indent, newline }
}

/**
 * Writes the given data to the specified JSON file.
 */
async function writeJsonFile(file: JsonFile): Promise<void> {
  let json = JSON.stringify(file.data, undefined, file.indent)

  if (file.newline)
    json += file.newline

  return writeTextFile({ ...file, data: json })
}

/**
 * Reads a text file and returns its contents.
 */
function readTextFile(name: string, cwd?: string): Promise<TextFile> {
  return new Promise((resolve, reject) => {
    let filePath: string

    if (cwd)
      filePath = path.join(cwd, name)
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
function writeTextFile(file: TextFile): Promise<void> {
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
 * Determine whether a path is a folder.
 */
function isFolder(path: string): boolean {
  try {
    return fs.statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

/**
 * Determine whether a path is a file.
 */
function isFile(path: string): boolean {
  return fs.existsSync(projectPath(path))
}

/**
 * Determine whether a folder has any files in it.
 */
function hasFiles(folder: string): boolean {
  return fs.readdirSync(folder).length > 0
}

function hasComponents(): boolean {
  return hasFiles(componentsPath())
}

function hasFunctions(): boolean {
  return hasFiles(functionsPath())
}

function copyFolder(src: string, dest: string, exclude: string[] = []): void {
  if (!fs.existsSync(dest))
    fs.mkdirSync(dest, { recursive: true })

  if (fs.existsSync(src)) {
    fs.readdirSync(src).forEach((file) => {
      if (!contains(path.join(src, file), exclude)) {
        const srcPath = path.join(src, file)
        const destPath = path.join(dest, file)

        if (fs.statSync(srcPath).isDirectory())
          copyFolder(srcPath, destPath, exclude)

        else
          fs.copyFileSync(srcPath, destPath)
      }
    })
  }
}

async function deleteFolder(path: string) {
  if (fs.statSync(path).isDirectory())
    await fs.rmSync(path, { recursive: true, force: true })
}

function deleteFiles(dir: string, exclude: string[] = []) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const p = path.join(dir, file)
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

function deleteEmptyFolders(dir: string) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const p = path.join(dir, file)
      if (fs.statSync(p).isDirectory()) {
        if (fs.readdirSync(p).length === 0)
          fs.rmSync(p, { recursive: true, force: true })

        else deleteEmptyFolders(p)
      }
    })
  }
}

function doesFolderExist(path: string) {
  return fs.existsSync(path)
}

export {
  _dirname,
  readJsonFile,
  writeJsonFile,
  readTextFile,
  writeTextFile,
  isFolder,
  isFile,
  hasFiles,
  hasComponents,
  hasFunctions,
  copyFolder,
  deleteFolder,
  deleteFiles,
  deleteEmptyFolders,
  doesFolderExist,
  fs, // todo: use ...fs
  fileURLToPath,
}
