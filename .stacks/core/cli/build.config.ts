import { alias } from '@stacksjs/alias'
import { defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  failOnWarn: false,
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
})
