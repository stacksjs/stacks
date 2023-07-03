import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    './src/unocss',
  ],

  clean: false,
  declaration: true,
})
