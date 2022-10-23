import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  externals: ['@stacksjs/utils', '@stacksjs/paths', '@stacksjs/types'],
  rollup: {
    inlineDependencies: true,
  },
})
