import { path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { intro, outro } from '../core/build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const entrypoints = await glob([path.appPath('*.ts'), path.appPath('**/*.ts')])

const result = await Bun.build({
  entrypoints,
  outdir: path.frameworkPath('api/dist'),
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
