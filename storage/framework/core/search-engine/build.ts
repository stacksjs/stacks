await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/config',
    '@stacksjs/ui',
    '@stacksjs/utils',
    '@stacksjs/logging',
    '@stacksjs/validation',
    'meilisearch',
  ],

})
