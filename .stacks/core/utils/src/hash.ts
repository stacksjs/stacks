import { hashDirectory } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'

export const originRequestFunctionCodeHash = hashDirectory(p.cloudPath('src/edge'))
