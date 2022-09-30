#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { join, resolve } from 'pathe'

// relative to scripts directory
const destinations = [
  ['../../dist/types/components', '../../components/dist/types'],
  ['../../dist/types/functions', '../../functions/dist/types'],
]

// copy files and/or folders from src to dest
export const copyFiles = async (src: string, dest: string) => {
  if (!existsSync(src))
    return

  if (statSync(src).isDirectory()) {
    if (!existsSync(dest))
      mkdirSync(dest, { recursive: true })

    readdirSync(src).forEach((file) => {
      if (file !== 'node_modules') // no need to ever copy node_modules
        copyFiles(join(src, file), join(dest, file))
    })

    return
  }

  copyFileSync(src, dest)
}

export const deleteFolder = async (path: string) => {
  await rmSync(path, { recursive: true, force: true })
}

destinations.forEach(([src, dest]) => {
  const srcPath = resolve(__filename, '..', src)
  const destPath = resolve(__filename, '..', dest)

  copyFiles(srcPath, destPath)
})
