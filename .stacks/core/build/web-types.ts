import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { version } from 'framework/components/vue/package.json' assert {type: 'json'}
import { componentsPath, frameworkPath } from '@stacksjs/path'
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
