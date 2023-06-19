import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/drivers/fathom',
    './src/index',
  ],

  clean: true,
  declaration: true,
})
