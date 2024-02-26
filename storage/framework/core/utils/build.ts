import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/logging',
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
    '@stacksjs/strings',
    'bun',
    'dinero.js',
    '@dinero.js/currencies',
    'export-size',
    'hookable',
    'js-yaml',
    'macroable',
    'neverthrow',
    'perfect-debounce',
    'p-limit',
    'vue',
    'vueuse',
    '@vueuse/math',
    '@vueuse/head',
    // 'pretty-bytes',
    'yaml',
    'magic-regexp',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
