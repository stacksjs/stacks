import type { BuildConfig } from 'unbuild'

export { defineBuildConfig } from 'unbuild'

const devEntries = [{
  input: './src/index',
  outDir: './dist',
}]

export const buildEntries = [{
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
