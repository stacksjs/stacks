import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/utils'

export default defineBuildConfig({
  alias,
  entries: [
    './src/cli.ts',
  ],
  declaration: true,
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
})
