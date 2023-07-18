import type { BuildConfig } from 'unbuild'
import { defineBuildConfig } from 'unbuild'
import { alias } from './src/index'

const devEntries = [{
  input: './src/index',
  outDir: './dist',
}]
const buildEntries = [{
  builder: 'mkdist',
  input: './src',
  outDir: './dist',
}]
const entries: BuildConfig['entries'] = process.env.npm_lifecycle_script?.includes('--stub')
  ? devEntries
  : buildEntries

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/path',
  ],

  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
  declaration: true,
  rollup: {
    emitCJS: true,
  },
})
