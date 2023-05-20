import { alias } from '@stacksjs/alias'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
