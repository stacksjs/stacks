await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',

  external: [
    'vitepress',
    '@stacksjs/config',
    '@stacksjs/alias',
    '@stacksjs/path',
    '@stacksjs/vite',
    '@stacksjs/server',
    '@stacksjs/env',
    '@stacksjs/cli',
    '@vite-pwa/vitepress',
    'vitepress-plugin-twoslash',
  ],

})
