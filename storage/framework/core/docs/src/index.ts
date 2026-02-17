import type { BunPressOptions } from '@stacksjs/bunpress'
import { docs } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'

export const frameworkDefaults: BunPressOptions = {
  docsDir: p.projectPath('docs'),
  outDir: p.frameworkPath('docs/dist'),
}

// Merge framework defaults with user config from config/docs.ts
export const docsConfig: BunPressOptions = {
  ...frameworkDefaults,
  ...docs,
}

export * from './meta'
