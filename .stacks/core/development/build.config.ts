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
    '@stacksjs/alias',
    '@stacksjs/logging',
    'unbuild',
  ],

  clean: true,
  declaration: true,
})
