import { path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { intro, outro } from '../core/build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
  pkgName: 'server',
})

const entrypoints = await glob([path.appPath('*.ts'), path.appPath('**/*.ts')])

const result = await Bun.build({
  entrypoints,
  outdir: path.frameworkPath('server/dist'),
  format: 'esm',
  target: 'bun',
  minify: true,
  sourcemap: 'linked',
  splitting: true,
})

// TODO: this is a bundler issue and those files should not need to be copied
await Bun.$`cp -r ${path.projectStoragePath('app')} ${path.userServerPath('dist')}`.text()
await Bun.$`rm -rf ${path.projectStoragePath('app')}`.text()

await outro({
  dir: import.meta.dir,
  startTime,
  result,
  pkgName: 'server',
})
