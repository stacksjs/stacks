import { hashPaths } from 'stacks:storage'
import { path as p } from 'stacks:path'
import { config } from 'stacks:config'

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
