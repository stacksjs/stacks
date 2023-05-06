import { alias } from '@stacksjs/alias'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
