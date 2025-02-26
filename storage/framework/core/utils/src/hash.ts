import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { hashPaths } from '@stacksjs/storage'

export function originRequestFunctionHash(): string | undefined {
  try {
    return hashPaths(path.cloudPath('src/edge'))
  }
  catch (error: any) {
    log.error('Are we in a Docker container? Failed to hash paths. Error below:')
    log.error(error)
    return undefined
  }
}

export function websiteSourceHash(): string | undefined {
  const docsSrc = [
    path.projectPath('docs'),
    path.frameworkPath('docs/dist'),
  ]

  const websiteSrc = [
    path.projectPath('resources/views'),
    path.projectPath('resources/assets'),
    path.projectPath('resources/lang'),
    path.projectPath('resources/functions'),
    path.projectPath('resources/components'),
    path.projectPath('resources/modules'),
    path.projectPath('resources/stores'),
    path.frameworkPath('views/web'),
  ]

  return config.app.docMode === true ? hashPaths(docsSrc) : hashPaths(websiteSrc)
}

export function docsSourceHash(): string | undefined {
  const docsSrc = [
    path.projectPath('docs'),
    path.frameworkPath('docs/dist'),
  ]

  return hashPaths(docsSrc)
}
