import type { BuildConfig } from '@stacksjs/development'
import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

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
  clean: false,
  declaration: true,
})
