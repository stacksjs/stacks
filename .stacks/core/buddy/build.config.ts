import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    './src/cli',
  ],

  declaration: true,
  clean: false,
})
