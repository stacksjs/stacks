import type { BuildConfig } from '@stacksjs/development'
import { alias, defineBuildConfig } from '@stacksjs/development'

type Entries = BuildConfig['entries']
const devEntries: Entries = [{
  builder: 'mkdist',
  input: './src/',
  outDir: './dist/',
}]
const buildEntries = [{
  builder: 'mkdist',
  input: './src/',
  outDir: './dist/',
}]
const command = process.env.npm_lifecycle_script
const entries: Entries = command?.includes('--stub') ? devEntries : buildEntries

export default defineBuildConfig({
  alias,

  entries,

  // externals: [
  //   // '@vinejs/vine',
  //   '@stacksjs/utils',
  // ],
  //
  // rollup: {
  //   inlineDependencies: true,
  // },

  clean: true,
  // declaration: true,
})
