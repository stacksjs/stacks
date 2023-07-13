import { defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

// const devEntries = [{
//   input: './src/index',
//   outDir: './dist',
// }]
// const buildEntries = [{
//   input: './src/index',
//   outDir: './dist',
// }]
// export const entries: BuildConfig['entries'] = process.env.npm_lifecycle_script?.includes('--stub')
//   ? devEntries
//   : buildEntries

export default defineBuildConfig({
  alias,
  entries,

  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
  declaration: true,

  rollup: {
    emitCJS: true,
  },
})
