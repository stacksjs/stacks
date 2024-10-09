import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import process from 'node:process'
import { componentsPath, frameworkPath } from '@stacksjs/path'
import { frameworkVersion } from '@stacksjs/utils'
import library from '~/config/library'

export default {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**/[a-zA-Z]*.vue',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name || 'stacks',
  packageVersion: await frameworkVersion(),
  watch: false,
} satisfies WebTypesBuilderConfig
