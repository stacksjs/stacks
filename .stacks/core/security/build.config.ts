import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/validation',
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
