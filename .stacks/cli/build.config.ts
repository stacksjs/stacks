import { defineBuildConfig } from 'unbuild'
import alias from '../core/alias'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: false,
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
})
