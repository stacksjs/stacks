import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  externals: [
    '@stacksjs/storage',
    '@stacksjs/cli',
    '@stacksjs/path',
    '@stacksjs/types',
  ],
  rollup: {
    inlineDependencies: true,
  },
})
