import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/utils/config',
    '.src/index.ts',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  failOnWarn: false,
})
