import { alias } from '@stacksjs/alias'
import { defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    'stacks',
    'stacks/vite',
    'stacks/utils',
    'stacks/validation',
    '@stacksjs/path',
  ],

  declaration: false, // todo: investigate why it errors when enabled & whether it's useful
  clean: true,
  rollup: {
    emitCJS: true,
  },
})
