import { alias, defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'

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
