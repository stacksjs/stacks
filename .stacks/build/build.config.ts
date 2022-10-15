import { defineBuildConfig } from 'unbuild'
import alias from '../core/alias'

export default defineBuildConfig({
  alias,
  entries: [
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist',
    },
  ],
  declaration: true,
  clean: true,
  // rollup: {
  //   inlineDependencies: true,
  // },
})
