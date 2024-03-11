await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/collections',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/validation',
  ],

})
