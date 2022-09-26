#!/usr/bin/env node

/**
 * Thanks for inspiration:
 * https://github.com/vueuse/vueuse/blob/main/scripts/fix-types.ts
 */

import fg from 'fast-glob'
import fs from 'fs-extra'

export async function useVueDemi(paths: string[]) {
  const files = await fg(paths, {
    onlyFiles: true,
  })

  for (const f of files) {
    const raw = await fs.readFile(f, 'utf-8')
    const changed = raw
      .replace(/"@vue\/composition-api"/g, '\'vue-demi\'')
      .replace(/"vue"/g, '\'vue-demi\'')
      .replace(/'vue'/g, '\'vue-demi\'')
    await fs.writeFile(f, changed, 'utf-8')
  }
}

// useVueDemi()
