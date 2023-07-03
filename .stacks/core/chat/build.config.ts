import { alias } from '@stacksjs/alias'
import { defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  clean: false,
  declaration: true,
})
