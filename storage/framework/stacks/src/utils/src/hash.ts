import { hashPaths } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { config } from '@stacksjs/config'

export const originRequestFunctionHash = hashPaths(p.cloudPath('src/edge'))

const docsSrc = [
  p.projectPath('docs'),
  p.projectPath('config/docs.ts'),
]

const websiteSrc = [
  p.projectPath('resources/views'),
  // p.projectPath('config/app.ts'),
]

export const websiteSourceHash = config.app.docMode === true ? hashPaths(docsSrc) : hashPaths(websiteSrc)
