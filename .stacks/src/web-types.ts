import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { version } from '../vue-components/package.json'
import { library } from '../config/src'
import { componentsPath, frameworkPath } from './helpers'

export default <WebTypesBuilderConfig> {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**\/[a-zA-Z]*.vue',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name,
  packageVersion: version,
  watch: false,
}
