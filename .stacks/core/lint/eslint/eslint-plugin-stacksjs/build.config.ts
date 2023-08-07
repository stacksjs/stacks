import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  externals: [
    'bun:test',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
})
