#!/usr/bin/env bun

/**
 * This action copies all the generated types.
 */

import { frameworkPath } from '@stacksjs/path'
import { copyFolder } from '@stacksjs/storage'

// relative to scripts directory
const destinations = [
  [frameworkPath('dist/types/components'), frameworkPath('components/vue/dist/types')],
  [frameworkPath('dist/types/components'), frameworkPath('components/web/dist/types')],
  [frameworkPath('dist/types/functions'), frameworkPath('functions/dist/types')],
]

destinations.forEach(([src, dest]) => {
  // const srcPath = resolve(__filename, '..', src)
  // const destPath = resolve(__filename, '..', dest)

  copyFolder(src as string, dest as string)
})
