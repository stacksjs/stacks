import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,

  entries: [
    // {
    //   input: './src/utils/config',
    //   format: 'cjs',
    // },
    './src/index',
  ],

  externals: [
    '@stacksjs/error-handling',
    '@stacksjs/config',
    '@stacksjs/logging',
    '@stacksjs/types',
  ],

  declaration: true,
  clean: false,
})
