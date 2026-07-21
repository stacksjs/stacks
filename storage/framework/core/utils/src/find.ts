/* eslint no-console: 0 */
import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { italic } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'

const targetFileName = 'buddy' // The exact name of the target file

// Always-excluded — these are noise regardless of where the search root is.
const alwaysExcludePatterns: Array<string | RegExp> = [
  'node_modules',
  'dist',
  'vendor',
  'storage/framework',
  /.*out.*/, // exclude any folder with 'out' in the name
  /.*\/\..*/, // exclude any folder that starts with a dot
]

// Home-dir noise — only excluded when the search defaults to `os.homedir()`.
// If the caller passes an explicit `dir`, they've opted in to searching it
// even when it lives under one of these paths (e.g. `~/Documents/Projects`).
const homeOnlyExcludePatterns: string[] = [
  `${os.homedir()}/Documents`,
  `${os.homedir()}/Pictures`,
  `${os.homedir()}/Library`,
  `${os.homedir()}/.Trash`,
]

interface FindStacksProjectsOptions {
  quiet?: boolean
}

const MAX_CONCURRENT_FS_READS = 32
let activeFsReads = 0
const fsReadQueue: Array<() => void> = []

async function withFsReadSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeFsReads >= MAX_CONCURRENT_FS_READS)
    await new Promise<void>(resolve => fsReadQueue.push(resolve))

  activeFsReads++
  try {
    return await operation()
  }
  finally {
    activeFsReads--
    fsReadQueue.shift()?.()
  }
}

export async function findStacksProjects(dir?: string, options?: FindStacksProjectsOptions): Promise<string[]> {
  const dirWasExplicit = !!dir
  dir = dir || os.homedir()

  const excludePatterns: Array<string | RegExp> = dirWasExplicit
    ? alwaysExcludePatterns
    : [...alwaysExcludePatterns, ...homeOnlyExcludePatterns]

  if (!options?.quiet) {
    log.info(`Searching for Stacks projects in: ${italic(dir)}`)
    log.info(`This may take a few moments...`)
    console.log('')
    console.log(italic('  Please note, while Stacks is searching for projects on your machine,'))
    console.log(italic('  you may be asked for permissions to scan certain directories.'))
    console.log('')
    log.debug(`Excluding directories: ${excludePatterns.join(', ')}`)
  }

  const foundProjects = await searchDirectory(dir, excludePatterns)

  if (!foundProjects)
    throw new Error('No Stacks projects found')

  return foundProjects
}

// this searches a dir for Stacks projects which we define
// as a dir that contains a 'buddy' file and a 'storage'
// dir with a 'framework/core/buddy' structure
async function searchDirectory(directory: string, excludePatterns: Array<string | RegExp>): Promise<string[]> {
  const isExcluded = excludePatterns.some(pattern =>
    typeof pattern === 'string' ? directory.includes(pattern) : pattern.test(directory),
  )

  if (isExcluded)
    return []

  let items: Dirent[]
  try {
    items = await withFsReadSlot(() => fs.readdir(directory, { withFileTypes: true }))
  }
  catch (error) {
    console.error(`Error reading directory ${directory}:`, error)
    return []
  }

  const buddyFileFound = items.some(item => item.isFile() && item.name === targetFileName)
  const storageDirFound = items.some(item => item.isDirectory() && item.name === 'storage')
    && await withFsReadSlot(() => fs.access(path.join(directory, 'storage/framework/core/buddy'))).then(() => true).catch(() => false)

  // A framework's storage tree contains tens of thousands of files but can
  // never contain another project root. Prune it and traverse sibling
  // directories concurrently. The former depth-first await made a typical
  // ~/Code scan take many seconds even on an SSD.
  const children = items
    .filter(item => item.isDirectory() && item.name !== 'storage')
    .map(item => searchDirectory(path.join(directory, item.name), excludePatterns))
  const nested = (await Promise.all(children)).flat()

  if (buddyFileFound && storageDirFound)
    nested.push(directory)

  return nested
}
