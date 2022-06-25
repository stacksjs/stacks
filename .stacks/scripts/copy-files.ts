import { copyFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

// relative to scripts directory
const destinations = [
  // ['../dist/packages/components', '../packages/core/types/components'],
  // ['../dist/packages/elements', '../packages/core/types/components'],
  ['../dist/functions', '../.stacks/types/functions'],
]

const copyRecursiveSync = function (src: string, dest: string) {
  const exists = existsSync(src)
  const stats = exists ? statSync(src) : false
  // const isDirectory = exists && stats.isDirectory()
  const isDirectory = stats

  if (isDirectory) {
    readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName))
    })

    return
  }

  copyFileSync(src, dest)
}

destinations.forEach(([src, dest]) => {
  const srcPath = resolve(__filename, '..', src)
  const destPath = resolve(__filename, '..', dest)

  copyRecursiveSync(srcPath, destPath)
})
