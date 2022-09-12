import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/index',
    './src/cli',
  ],
  outDir: './dist',
  declaration: true,
  failOnWarn: false,
  clean: true,
  rollup: {
    emitCJS: true,
  },
})
