await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    'fs-extra',
    '@stacksjs/path',
    '@stacksjs/validation',
  ],

})
