import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  declaration: true,
  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
})
