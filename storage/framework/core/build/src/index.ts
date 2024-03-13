import process from 'node:process'
import { path as p } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { bold, dim, green, italic, log } from '@stacksjs/cli'

export async function outro(options: {
  dir: string
  startTime: number
  result: any
}) {
  const endTime = Date.now()
  const timeTaken = endTime - options.startTime
  const pkgName = `@stacksjs/${p.basename(options.dir)}`

  if (!options.result.success) {
    // eslint-disable-next-line no-console
    console.log(options.result.logs[0])
    process.exit(1)
  }

  // loop over all the files in the dist directory and log them and their size
  const files = await glob(p.resolve(options.dir, 'dist', '*'))
  for (const file of files) {
    const stats = await fs.stat(file)

    let sizeStr
    if (stats.size < 1024 * 1024) {
      const sizeInKb = stats.size / 1024
      sizeStr = `${sizeInKb.toFixed(2)}kb`
    }
    else {
      const sizeInMb = stats.size / 1024 / 1024
      sizeStr = `${sizeInMb.toFixed(2)}mb`
    }

    const relativeFilePath = p.relative(options.dir, file).replace('dist/', '')
    // eslint-disable-next-line no-console
    console.log(`${bold(dim(`[${sizeStr}]`))} ${dim('dist/')}${relativeFilePath}`)
  }

  log.success(`${bold(dim(`[${timeTaken}ms]`))} Built ${italic(bold(green(pkgName)))}`)
}

export async function intro(options: {
  dir: string
}) {
  const pkgName = `@stacksjs/${p.basename(options.dir)}`

  log.info(`Building ${italic(pkgName)}...`)
  const startTime = Date.now()

  return { startTime }
}
