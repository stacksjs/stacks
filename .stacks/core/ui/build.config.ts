import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    './src/unocss',
  ],

  clean: false,
  declaration: true,
})
