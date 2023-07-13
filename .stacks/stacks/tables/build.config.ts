import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: ['chalk'],

  declaration: true,
  clean: false,
})
