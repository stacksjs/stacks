import { hashPaths } from 'src/storage/src'
import { path as p } from 'src/path/src'
import { config } from 'src/config/src'

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
