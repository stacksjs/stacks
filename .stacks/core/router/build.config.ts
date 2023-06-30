import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/types',
    'vue-router',
  ],

  clean: true,
  declaration: true,
})
