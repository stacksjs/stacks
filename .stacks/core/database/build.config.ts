import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
  externals: [
    '@stacksjs/storage',
  ],
})
