import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { componentsPath, frameworkPath } from '@stacksjs/path'
import { library } from '@stacksjs/config'
import { frameworkVersion } from '@stacksjs/utils'

export default {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**\/[a-zA-Z]*.vue',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name,
  packageVersion: await frameworkVersion(),
  watch: false,
} satisfies WebTypesBuilderConfig
