/**
 * Thanks: https://github.com/unocss/unocss/blob/main/scripts/size.ts
 */

import fs from 'fs/promises'
import { sync as brotli } from 'brotli-size'
import { gzipSizeSync as gzip } from 'gzip-size'
import { minify } from 'terser'
import fg from 'fast-glob'
import { version } from '../package.json'

const packages = [
  'hello-world-vue',
  'hello-world-elements',
  'hello-world-composables',
]

console.log()
console.log(`hello-world v${version}`)

for (const pkg of packages) {
  const files = fg.sync(`packages/${pkg}/dist/**/*.mjs`, { absolute: true })
  let minified = ''

  for (const file of files) {
    const code = await fs.readFile(file, 'utf8')
    minified += (await minify(code)).code
  }

  console.log()
  console.log(`@ow3/${pkg}`) // this would be your $orgName/$pkgName as distributed via npm
  console.log(`gzip    ${(gzip(minified) / 1024).toFixed(2)} KiB`)
  console.log(`brotli  ${(brotli(minified) / 1024).toFixed(2)} KiB`)
}
