import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
