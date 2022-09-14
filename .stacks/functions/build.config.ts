import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['../../config/functions'],
  outDir: './dist',
  declaration: true,
  clean: true,
  // externals: ['vue'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
