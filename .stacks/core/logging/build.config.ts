import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  externals: ['vue-ray', 'node-ray'],
  rollup: {
    inlineDependencies: true,
  },
})
