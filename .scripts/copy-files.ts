import { copyFileSync, existsSync, statSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'

// relative to scripts directory
const destinations = [
  // i need to copy folders, instead of individual files
  ['../dist/packages/vue/src/components', '../packages/types/components'],
  ['../dist/packages/elements/src/components', '../packages/types/components'],
  ['../dist/packages/composables/src', '../packages/types/composables'],
]

let copyRecursiveSync = function (src, dest) {
  let exists = existsSync(src);
  let stats = exists && statSync(src);
  let isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName));
    });

    return
  }

  copyFileSync(src, dest);
};

const _filename = import.meta.url ? fileURLToPath(import.meta.url) : __filename

destinations.forEach(([src, dest]) => {
  let srcPath = resolve(__filename, '..', src)
  let destPath = resolve(_filename, '..', dest)

  copyRecursiveSync(srcPath, destPath)
})
