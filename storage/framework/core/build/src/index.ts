import process from 'node:process'
import { bold, dim, green, italic, log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'

export async function outro(options: {
  dir: string
  startTime: number
  result: any
  pkgName?: string
}): Promise<void> {
  const endTime = Date.now()
  const timeTaken = endTime - options.startTime
  const pkgName = options.pkgName ?? `@stacksjs/${p.basename(options.dir)}`

  if (!options.result.success) {
    // eslint-disable-next-line no-console
    console.log(options.result.logs[0])
    process.exit(1)
  }

  // loop over all the files in the dist directory and log them and their size
  const files = await glob([p.resolve(options.dir, 'dist', '**/*')], { absolute: true })
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

  // eslint-disable-next-line no-console
  console.log(`${bold(dim(`[${timeTaken}ms]`))} Built ${italic(bold(green(pkgName)))}`)
}

export async function intro(options: { dir: string, pkgName?: string, styled?: boolean }): Promise<{
  startTime: number
}> {
  const pkgName = options.pkgName ?? `@stacksjs/${p.basename(options.dir)}`

  if (options.styled === false) // eslint-disable-next-line no-console
    console.log(`Building ${pkgName}...`)
  else log.info(`Building ${italic(pkgName)}...`)

  return { startTime: Date.now() }
}

export * from './utils'
