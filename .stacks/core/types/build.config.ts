import { alias, defineBuildConfig } from '@stacksjs/development'

// type Entries = BuildConfig['entries']
// const entries: Entries = [{
//   builder: 'mkdist',
//   input: './src/index',
//   outDir: './dist/',
// }]
// const buildEntries = devEntries
// const command = process.env.npm_lifecycle_script
// const entries: Entries = command?.includes('--stub') ? devEntries : buildEntries

export default defineBuildConfig({
  alias,

  entries: [{
    builder: 'mkdist',
    input: './src/',
    outDir: './dist/',
  }],

  externals: [
    '@dinero.js/core',
    '@stacksjs/utils',
    '@dinero.js/currencies',
    'dinero.js',
    'perfect-debounce',
    'rimraf',
  ],

  // rollup: {
  //   inlineDependencies: true,
  // },

  clean: true,
  declaration: true,
})
