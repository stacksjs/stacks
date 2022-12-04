import { defineBuildConfig } from 'unbuild'
import { projectPath } from '@stacksjs/path'

export default defineBuildConfig({
  alias: {
    'config/*': projectPath('config/*'),
    'config': projectPath('config'),
  },
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  externals: ['@stacksjs/utils', '@stacksjs/path', '@stacksjs/types'],
  rollup: {
    inlineDependencies: true,
  },
})
