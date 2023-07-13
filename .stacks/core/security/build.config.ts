import { defineBuildConfig, entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/validation',
    'bcryptjs',
    'crypto-js',
    'js-base64',
  ],

  clean: false,
  declaration: true,
})
