/* eslint no-console: 0 */
import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { italic } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'

const targetFileName = 'buddy' // The exact name of the target file

const excludePatterns = [
  'node_modules',
  'dist',
  'vendor',
  'storage/framework',
  `${os.homedir()}/Documents`,
  `${os.homedir()}/Pictures`,
  `${os.homedir()}/Library`,
  `${os.homedir()}/.Trash`,
  /.*out.*/, // exclude any folder with 'out' in the name
  /.*\/\..*/, // exclude any folder that starts with a dot
]

interface FindStacksProjectsOptions {
  quiet?: boolean
}

export async function findStacksProjects(dir?: string, options?: FindStacksProjectsOptions): Promise<string[]> {
  dir = dir || os.homedir()

  if (!options?.quiet) {
    log.info(`Searching for Stacks projects in: ${italic(dir)}`)
    log.info(`This may take a few moments...`)
    console.log('')
    console.log(italic('  Please note, while Stacks is searching for projects on your machine,'))
    console.log(italic('  you may be asked for permissions to scan certain directories.'))
    console.log('')
    log.debug(`Excluding directories: ${excludePatterns.join(', ')}`)
  }

  const foundProjects = await searchDirectory(dir)

  if (!foundProjects)
    throw new Error('No Stacks projects found')

  return foundProjects
}

// this searches a dir for Stacks projects which we define
// as a dir that contains a 'buddy' file and a 'storage'
// dir with a 'framework/core/buddy' structure
async function searchDirectory(directory: string): Promise<string[]> {
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
        catch (error) {
          console.error(`Error accessing directory ${storagePath}:`, error)
        }
      }

      // Accumulate results from recursive calls
      const subDirProjects = await searchDirectory(fullPath)
      foundProjects.push(...subDirProjects)
    }
  }

  if (buddyFileFound && storageDirFound) {
    foundProjects.push(directory)
  }

  return foundProjects
}
