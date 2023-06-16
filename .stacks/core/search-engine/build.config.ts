import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    // {
    //   builder: 'mkdist',
    //   input: './src/',
    //   outDir: './dist/',
    //   format: 'esm',
    // },
  ],

  externals: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/ui',
    'meilisearch',
  ],

  rollup: {
    inlineDependencies: true,
  },

  declaration: true,
  clean: true,
})
