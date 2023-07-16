import { alias } from '@stacksjs/alias'
import { defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'

// this is just the config to build the stacks/config
// so users could do
// import { app } from '@stacksjs/config'

// app.url === 'https://stacks.test' or whatever set in env
// let me show you now the auto-imports stuff

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
})
