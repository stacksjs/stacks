import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  failOnWarn: false,
  alias,
  entries: [
    './src/index',
  ],
  declaration: false,
  clean: false,
  externals: ['chalk'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
