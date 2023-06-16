import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
      format: 'esm',
    },
  ],

  externals: [
    '@stacksjs/types',
    'vue-router',
  ],

  rollup: {
    inlineDependencies: true,
  },

  clean: true,
  declaration: true,
})
