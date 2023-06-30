import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    './src/tinker',
  ],

  clean: true,
  declaration: true,
})
