import { hashPaths } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'

export function originRequestFunctionHash() {
  try {
    return hashPaths(p.cloudPath('src/edge'))
  }
  catch (error: any) {
    log.error('Are we in a Docker container? Failed to hash paths. Error below:')
    log.error(error)
    return undefined
  }
}

export function websiteSourceHash() {
  const docsSrc = [
    p.projectPath('docs'),
    p.projectPath('config/docs.ts'),
  ]

  const websiteSrc = [
    p.projectPath('resources/views'),
  // p.projectPath('config/app.ts'),
  ]

  return config.app.docMode === true ? hashPaths(docsSrc) : hashPaths(websiteSrc)
}
