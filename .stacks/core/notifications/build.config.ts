import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/utils/config',
    './src/index',
  ],

  rollup: {
    emitCJS: true,
  },
  declaration: true,
  clean: true,

})
