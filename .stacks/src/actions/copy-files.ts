#!/usr/bin/env node
import { resolve } from 'pathe'
import { copyFolder } from '../utils'

// relative to scripts directory
const destinations = [
  ['../../dist/types/components', '../../components/dist/types'],
  ['../../dist/types/functions', '../../functions/dist/types'],
]

destinations.forEach(([src, dest]) => {
  const srcPath = resolve(__filename, '..', src)
  const destPath = resolve(__filename, '..', dest)

  copyFolder(srcPath, destPath)
})
