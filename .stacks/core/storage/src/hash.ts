import * as crypto from 'node:crypto'
import { path as p } from '@stacksjs/path'
import { fs } from './fs'

export function hashDirectory(directory: string): string {
  const files = fs.readdirSync(directory)
  const hash = crypto.createHash('sha256')

  for (const file of files) {
    const filePath = p.join(directory, file)
    if (fs.statSync(filePath).isDirectory())
      hash.update(hashDirectory(filePath))

    else
      hash.update(fs.readFileSync(filePath))
  }

  return hash.digest('hex')
}
