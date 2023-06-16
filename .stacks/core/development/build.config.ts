import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
      format: 'esm',
    },
    './src/index',
  ],

  externals: [
    '@stacksjs/alias',
    '@stacksjs/logging',
    'unbuild',
  ],

  clean: true,
  declaration: true,
})
