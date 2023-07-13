import { defineBuildConfig, entries } from '../development/src'
import { alias } from '../alias/src'

export default defineBuildConfig({
  alias,
  entries,
  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
  declaration: true,

  rollup: {
    emitCJS: true,
  },
})
