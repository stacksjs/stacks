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
    '@stacksjs/config',
    '@stacksjs/types',
    'bcryptjs',
    'crypto-js',
    'js-base64',
  ],

  rollup: {
    inlineDependencies: true,
  },

  clean: true,
  declaration: true,
})
