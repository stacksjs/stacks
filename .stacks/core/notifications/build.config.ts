import { defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  entries: [
    './src/utils/config',
    './src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  failOnWarn: false,
})
