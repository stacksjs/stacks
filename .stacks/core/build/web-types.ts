import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { version } from 'framework/vue-components/package.json'
import { componentsPath, frameworkPath } from '@stacksjs/utils'
import { library } from '@stacksjs/config'

export default <WebTypesBuilderConfig> {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**\/[a-zA-Z]*.vue',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name,
  packageVersion: version,
  watch: false,
}
