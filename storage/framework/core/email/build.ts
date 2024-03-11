await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/types',
    'vue-email',
    '@vue-email/compiler',
    'json5',
    '@stacksjs/path',
    '@aws-sdk/client-ses',
  ],

})
