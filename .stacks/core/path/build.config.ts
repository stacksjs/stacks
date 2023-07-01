import { alias, defineBuildConfig } from '../development/src'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
  declaration: true,

  rollup: {
    emitCJS: true,
  },
})
