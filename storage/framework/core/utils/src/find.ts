import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { italic } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'

const targetFileName = 'buddy' // The exact name of the target file

// Assuming excludePatterns is defined somewhere in your script
const excludePatterns = [
  'node_modules',
  'dist',
  /.*out.*/,
  `${os.homedir()}/Documents`,
  `${os.homedir()}/Pictures`,
  `${os.homedir()}/Library`,
  `${os.homedir()}/.Trash`,
]

export async function findStacksProjects(dir: string): Promise<string[]> {
  log.info(`This may take a few moments, searching for Stacks projects in: ${italic(dir)}`)
  // eslint-disable-next-line no-console
  console.log('')
  // eslint-disable-next-line no-console
  console.log(italic('  Please note, while Stacks is searching for projects on your machine,'))
  // eslint-disable-next-line no-console
  console.log(italic('  you may be asked for permissions to scan certain directories.'))
  // eslint-disable-next-line no-console
  console.log('')
  log.debug(`Excluding directories: ${excludePatterns.join(', ')}`)

  const foundProjects: string[] = []

  async function searchDirectory(directory: string) {
    if (path.basename(directory).startsWith('.'))
      return

    const isExcluded = excludePatterns.some(pattern => typeof pattern === 'string' ? directory.includes(pattern) : pattern.test(directory))
    if (isExcluded)
      return

    let items: Dirent[]
    try {
      items = await fs.readdir(directory, { withFileTypes: true })
    }
    catch (error) {
      console.error(`Error reading directory ${directory}:`, error)
      return
    }

    let buddyFileFound = false
    let storageDirFound = false

    for (const item of items) {
      if (item.isFile() && item.name === targetFileName) {
        buddyFileFound = true
      }
      else if (item.isDirectory()) {
        // Recursively search in directories
        const fullPath = path.join(directory, item.name)
        if (item.name === 'storage') {
          // Check if the 'storage/framework/core/buddy/' structure exists within this directory
          try {
            const storagePath = path.join(fullPath, 'framework/core/buddy')
            await fs.access(storagePath)
            storageDirFound = true
          }
          catch (error) {
            // The specific directory structure does not exist
          }
        }
        await searchDirectory(fullPath)
      }
    }

    if (buddyFileFound && storageDirFound)
      foundProjects.push(directory) // Both conditions are met
  }

  await searchDirectory(dir)
  return foundProjects
}
