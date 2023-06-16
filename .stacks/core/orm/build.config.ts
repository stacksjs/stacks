import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
})
