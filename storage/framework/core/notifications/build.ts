await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/chat',
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/email',
    '@stacksjs/error-handling',
    '@stacksjs/push',
    '@stacksjs/sms',
    '@stacksjs/types',
  ],

})
