import { defineBuildConfig } from 'unbuild'
import alias from '../src/alias'

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
