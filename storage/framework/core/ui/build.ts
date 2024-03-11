await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/config',
    'unocss',
    '@headlessui/vue',
    '@julr/unocss-preset-forms',
    'vue',
    'pinia',
  ],

})
