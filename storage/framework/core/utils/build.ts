import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/arrays',
    '@stacksjs/collections',
    '@stacksjs/config',
    '@stacksjs/env',
    '@stacksjs/error-handling',
    '@stacksjs/objects',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/types',
    '@stacksjs/validation',
    'bun',
    'dinero.js',
    'export-size',
    'hookable',
    'js-yaml',
    'macroable',
    'neverthrow',
    'perfect-debounce',
    'p-limit',
    'vue',
    'vueuse',
    'yaml',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
