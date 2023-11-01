import { hashDirectory } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { config } from '@stacksjs/config'

export const originRequestFunctionHash = hashDirectory(p.cloudPath('src/edge'))
export const websiteSourceHash = config.app.docMode ? hashDirectory(p.projectPath('docs')) : hashDirectory(p.projectPath('resources/views'))
