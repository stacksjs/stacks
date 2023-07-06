import type { BuildConfig } from 'unbuild'

export { defineBuildConfig } from 'unbuild'
export * from '@stacksjs/logging'
export * from '@stacksjs/alias'

const devEntries = [{
  input: './src/index',
  outDir: './dist',
}]
const buildEntries = [{
  builder: 'mkdist',
  input: './src',
  outDir: './dist',
}]
export const entries: BuildConfig['entries'] = process.env.npm_lifecycle_script?.includes('--stub')
  ? devEntries
  : buildEntries

export const withCjsEntries = [{
  input: './src/index',
  outDir: './dist',
}]

export type { BuildConfig }
