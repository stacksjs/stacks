import { copyFileSync, existsSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, resolve } from 'path'

// relative to scripts directory
const destinations = [
  // ['../dist/packages/components', '../packages/core/types/components'],
  // ['../dist/packages/elements', '../packages/core/types/components'],
  ['../dist/functions', '../.stacks/types/functions'],
]

const copyRecursiveSync = function (src: string, dest: string) {
  const exists = existsSync(src)
  const stats = exists && statSync(src)
  const isDirectory = exists && stats.isDirectory()

  if (isDirectory) {
    readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName))
    })

    return
  }

  copyFileSync(src, dest)
}

const _filename = import.meta.url ? fileURLToPath(import.meta.url) : __filename

destinations.forEach(([src, dest]) => {
  const srcPath = resolve(__filename, '..', src)
  const destPath = resolve(_filename, '..', dest)

  copyRecursiveSync(srcPath, destPath)
})
