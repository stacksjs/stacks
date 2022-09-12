import { copyFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'pathe'

// relative to scripts directory
const destinations = [
  ['../../components.d.ts', '../../components/dist/index.d.ts'],
  ['../../components.d.ts', '../../elements/dist/index.d.ts'],
]

const copyRecursiveSync = function (src: string, dest: string) {
  const exists = existsSync(src)
  const stats = statSync(src)

  const isDirectory = exists && stats.isDirectory()

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
