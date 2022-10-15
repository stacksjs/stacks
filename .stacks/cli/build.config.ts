import { defineBuildConfig } from 'unbuild'
import alias from '../core/alias'

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
