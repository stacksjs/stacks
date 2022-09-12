#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'pathe'

// relative to scripts directory
const destinations = [
  ['../../dist/types/.stacks/src', '../../stacks/dist/types'],
  ['../../dist/types/components', '../../components/dist/types'],
  ['../../dist/types/functions', '../../functions/dist/types'],
]

// copy files and/or folders from src to dest
export const copyFiles = (src: string, dest: string) => {
  if (!existsSync(src))
    return

  if (statSync(src).isDirectory()) {
    if (!existsSync(dest))
      mkdirSync(dest, { recursive: true })

    readdirSync(src).forEach((file) => {
      copyFiles(join(src, file), join(dest, file))
    })

    return
  }

  copyFileSync(src, dest)
}

destinations.forEach(([src, dest]) => {
  const srcPath = resolve(__filename, '..', src)
  const destPath = resolve(__filename, '..', dest)

  // eslint-disable-next-line no-console
  console.log('copying', srcPath, 'to', destPath)

  copyFiles(srcPath, destPath)
})
