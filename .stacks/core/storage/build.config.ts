import { defineBuildConfig, alias } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],

  clean: true,
  declaration: true,
})
