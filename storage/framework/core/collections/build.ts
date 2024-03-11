await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',

  external: [
    'collect.js',
  ],

})
