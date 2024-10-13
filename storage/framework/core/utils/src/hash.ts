import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { hashPaths } from '@stacksjs/storage'

export function originRequestFunctionHash(): string | undefined {
  try {
    return hashPaths(p.cloudPath('src/edge'))
  }
  catch (error: any) {
    log.error('Are we in a Docker container? Failed to hash paths. Error below:')
    log.error(error)
    return undefined
  }
}

const docsSrc = [p.projectPath('docs'), p.frameworkPath('docs/dist')]

export function websiteSourceHash(): string | undefined {
  const websiteSrc = [
    p.projectPath('resources/views'),
    p.projectPath('resources/assets'),
    p.projectPath('resources/lang'),
    p.projectPath('resources/functions'),
    p.projectPath('resources/components'),
    p.projectPath('resources/modules'),
    p.projectPath('resources/stores'),
    p.frameworkPath('views/web'),
  ]

  return config.app.docMode === true ? hashPaths(docsSrc) : hashPaths(websiteSrc)
}

export function docsSourceHash(): string | undefined {
  return hashPaths(docsSrc)
}
