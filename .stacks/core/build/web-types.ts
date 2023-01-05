import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { componentsPath, frameworkPath } from '@stacksjs/path'
import { library } from '@stacksjs/config'
import { version } from './package.json' assert { type: 'json' }

export default <WebTypesBuilderConfig> {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**\/[a-zA-Z]*.vue',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name,
  packageVersion: version,
  watch: false,
}
