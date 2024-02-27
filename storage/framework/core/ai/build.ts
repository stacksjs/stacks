import dts from 'bun-plugin-dts-auto'

await Bun.build({
  root: './src',

  entrypoints: [
    './src/index.ts',
  ],

  outdir: './dist',
  format: 'esm',

  external: [
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-bedrock',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
