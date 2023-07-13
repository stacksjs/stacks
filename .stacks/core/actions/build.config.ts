import type { BuildConfig } from '@stacksjs/development'
import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

const devEntries: BuildConfig['entries'] = [
  {
    input: './src/build/component-libs',
    name: 'build/component-libs',
    outDir: './dist/build/',
  }, {
    input: './src/build/core',
    name: 'build/core',
    outDir: './dist/build/',
  }, {
    input: './src/build/stacks',
    name: 'build/stacks',
    outDir: './dist/build/',
  }, {
    input: './src/dev/index',
    name: 'dev/index',
    outDir: './dist/dev/',
  }, {
    input: './src/dev/components',
    name: 'dev/components',
    outDir: './dist/dev/',
  }, {
    input: './src/dev/docs',
    name: 'dev/docs',
    outDir: './dist/dev/',
  }, {
    input: './src/generate/index',
    name: 'generate/index',
    outDir: './dist/generate/',
  }, {
    input: './src/generate/component-meta',
    name: 'generate/component-meta',
    outDir: './dist/generate/',
  }, {
    input: './src/generate/ide-helpers',
    name: 'generate/ide-helpers',
    outDir: './dist/generate/',
  }, {
    input: './src/generate/lib-entries',
    name: 'generate/lib-entries',
    outDir: './dist/generate/',
  }, {
    input: './src/generate/settings',
    name: 'generate/settings',
    outDir: './dist/generate/',
  }, {
    input: './src/generate/vscode-custom-data',
    name: 'generate/vscode-custom-data',
    outDir: './dist/generate/',
  }, {
    input: './src/generate/vue-compat',
    name: 'generate/vue-compat',
    outDir: './dist/generate/',
  }, {
    input: './src/helpers/index',
    name: 'helpers/index',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/index',
    name: 'helpers/index',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/component-meta',
    name: 'helpers/component-meta',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/lib-entries',
    name: 'helpers/lib-entries',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/package-json',
    name: 'helpers/package-json',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/utils',
    name: 'helpers/utils',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/vscode-custom-data',
    name: 'helpers/vscode-custom-data',
    outDir: './dist/helpers/',
  }, {
    input: './src/helpers/vue-compat',
    name: 'helpers/vue-compat',
    outDir: './dist/helpers/',
  }, {
    input: './src/lint/index',
    name: 'lint/index',
    outDir: './dist/lint/',
  }, {
    input: './src/lint/fix',
    name: 'lint/fix',
    outDir: './dist/lint/',
  }, {
    input: './src/test/coverage',
    name: 'test/coverage',
    outDir: './dist/test/',
  }, {
    input: './src/test/feature',
    name: 'test/feature',
    outDir: './dist/test/',
  }, {
    input: './src/test/ui',
    name: 'test/ui',
    outDir: './dist/test/',
  }, {
    input: './src/test/unit',
    name: 'test/unit',
    outDir: './dist/test/',
  },
  {
    input: './src/upgrade/dependencies',
    name: 'upgrade/dependencies',
    outDir: './dist/upgrade/',
  },
  {
    input: './src/upgrade/framework',
    name: 'upgrade/framework',
    outDir: './dist/upgrade/',
  },
  {
    input: './src/upgrade/index',
    name: 'upgrade/index',
    outDir: './dist/upgrade/',
  },
  './src/index',
  './src/add',
  './src/build.ts', // we need to be specific here because we have a build folder
  './src/bump',
  './src/changelog',
  './src/clean',
  './src/commit',
  './src/copy-types',
  './src/examples',
  './src/fresh',
  './src/key-generate',
  './src/make',
  './src/migrate',
  './src/preinstall',
  './src/prepublish',
  './src/release',
  './src/seed',
  './src/test.ts', // we need to be specific here because we have a build folder
  './src/tinker',
  './src/typecheck',
  './src/types',
  './src/upgrade.ts', // we need to be specific here because we have a build folder
]
const buildEntries: BuildConfig['entries'] = [{
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
