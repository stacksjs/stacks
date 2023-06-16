import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
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
