import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    'vite',
    'vitepress',
  ],

  clean: false,
  declaration: true,
})
