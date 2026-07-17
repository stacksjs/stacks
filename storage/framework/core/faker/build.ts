import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  external: frameworkExternal(),
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

if (result.success) {
  const declarationCheck = Bun.spawnSync([
    'bunx',
    '--bun',
    'tsc',
    '--noEmit',
    '--ignoreConfig',
    '--skipLibCheck',
    '--moduleResolution',
    'bundler',
    '--module',
    'preserve',
    '--target',
    'esnext',
    './dist/index.d.ts',
  ], {
    cwd: import.meta.dir,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  if (declarationCheck.exitCode !== 0)
    throw new Error('Generated faker declarations are invalid')
}

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
