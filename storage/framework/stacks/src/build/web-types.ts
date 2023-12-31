import process from 'node:process'
import type { WebTypesBuilderConfig } from 'vue-docgen-web-types/types/config'
import { componentsPath, frameworkPath } from 'src/path/src'
import { frameworkVersion } from 'src/utils/src'
import library from '~/config/library'

export default {
  cwd: process.cwd(),
  componentsRoot: componentsPath(),
  components: '**\/[a-zA-Z]*.stx',
  outFile: frameworkPath('web-types.json'),
  packageName: library.name || 'stacks',
  packageVersion: await frameworkVersion(),
  watch: false,
} satisfies WebTypesBuilderConfig
