import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { hashPaths } from '@stacksjs/storage'

export function originRequestFunctionHash() {
  try {
    return hashPaths(p.cloudPath('src/edge'))
  } catch (error: any) {
    log.error('Are we in a Docker container? Failed to hash paths. Error below:')
    log.error(error)
    return undefined
  }
}

export function websiteSourceHash() {
  const docsSrc = [p.projectPath('docs')]
  const websiteSrc = [p.projectPath('resources/views')]

  return config.app.docMode === true ? hashPaths(docsSrc) : hashPaths(websiteSrc)
}

export function docsSourceHash() {
  const docsSrc = [p.projectPath('docs')]

  return hashPaths(docsSrc)
}
