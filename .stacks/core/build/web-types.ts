import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { version } from 'framework/vue-components/package.json'
import { componentsPath, frameworkPath, library } from '@stacksjs/utils'

export default <WebTypesBuilderConfig> {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**\/[a-zA-Z]*.vue',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name,
  packageVersion: version,
  watch: false,
}
