import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  externals: [
    'bun:test',
  ],
  declaration: false,
  clean: true,
  rollup: {
    emitCJS: true,
  },
})
