import { hashPaths } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { config } from '@stacksjs/config'

// eslint-disable-next-line import/no-mutable-exports
let originRequestFunctionHash
try {
  originRequestFunctionHash = hashPaths(p.cloudPath('src/edge'))
}
catch (error) {
  console.error('Are we in a Docker container? Failed to hash paths:', error)
  originRequestFunctionHash = null // or some default/fallback value
}
export { originRequestFunctionHash }

const docsSrc = [
  p.projectPath('docs'),
  p.projectPath('config/docs.ts'),
]

const websiteSrc = [
  p.projectPath('resources/views'),
  // p.projectPath('config/app.ts'),
]

export const websiteSourceHash = config.app.docMode === true ? hashPaths(docsSrc) : hashPaths(websiteSrc)
