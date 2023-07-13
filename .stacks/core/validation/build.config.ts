import { defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@vinejs/vine',
    'vite',
    'validator',
    '@stacksjs/path',
    '@stacksjs/utils',
    '@stacksjs/types',
  ],

  clean: false,
  declaration: false, // todo: this should be set to true

  rollup: {
    emitCJS: true,
  },
})
