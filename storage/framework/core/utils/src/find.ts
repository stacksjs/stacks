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
  const foundProjects: string[] = []
  const isExcluded = excludePatterns.some(pattern =>
    typeof pattern === 'string' ? directory.includes(pattern) : pattern.test(directory),
  )

  if (isExcluded)
    return foundProjects

  let items: Dirent[]
  try {
    items = await fs.readdir(directory, { withFileTypes: true })
  }
  catch (error) {
    console.error(`Error reading directory ${directory}:`, error)
    return foundProjects
  }

  let buddyFileFound = false
  let storageDirFound = false

  for (const item of items) {
    if (item.isFile() && item.name === targetFileName) {
      buddyFileFound = true
    }

    if (item.isDirectory()) {
      const fullPath = path.join(directory, item.name)
      if (item.name === 'storage') {
        const storagePath = path.join(fullPath, 'framework/core/buddy')
        try {
          await fs.access(storagePath)
          storageDirFound = true
        }
        catch {
          // Not a Stacks project — most directories named `storage` won't have
          // a framework/core/buddy inside. Swallow silently so the project
          // scan stays quiet across unrelated user code.
        }
      }

      // Accumulate results from recursive calls
      const subDirProjects = await searchDirectory(fullPath, excludePatterns)
      foundProjects.push(...subDirProjects)
    }
  }

  if (buddyFileFound && storageDirFound) {
    foundProjects.push(directory)
  }

  return foundProjects
}
