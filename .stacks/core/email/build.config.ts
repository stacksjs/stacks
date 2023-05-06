import { alias } from '@stacksjs/alias'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
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
