import { defineBuildConfig } from 'unbuild'
import { alias } from 'framework/core/stacks/src'

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
