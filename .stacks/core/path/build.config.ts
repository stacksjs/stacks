import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  clean: false, // logging, alias, development, storage, and path are all prerequisites for other packages—needed for the release process
  declaration: true,

  rollup: {
    emitCJS: true,
  },
})
