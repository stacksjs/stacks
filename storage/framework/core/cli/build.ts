await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',

  external: [
    'vite',
    '@antfu/install-pkg',
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/tunnel',
    '@stacksjs/logging',
    'prompts',
    '@stacksjs/utils',
    '@stacksjs/validation',
    '@stacksjs/error-handling',
    'ora',
    'kolorist',
    'cac',
    '@stacksjs/collections',
  ],

})
