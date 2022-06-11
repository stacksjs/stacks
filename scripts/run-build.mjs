/**
 * Thanks: https://github.com/vitebook/vitebook/blob/main/scripts/run-build.js
 */

import { exec } from 'child_process'
import { readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import Prompts from 'prompts'
import { dirname, resolve } from 'pathe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packagesDir = resolve(__dirname, '../packages')

const packages = readdirSync(packagesDir).filter(
  dirName => !dirName.includes('.') && dirName !== 'types',
)

const pkgArg = packages.includes(process.argv[2]) ? process.argv[2] : undefined
const pkgArgIndex = packages.findIndex(pkg => pkg === pkgArg)

const pkgIndex
    = pkgArgIndex >= 0
      ? pkgArgIndex
      : await Prompts.prompts.select({
        message: 'Pick a package',
        choices: packages,
        initial: 0,
      })

const pkg = packages[pkgIndex]
// const watch = process.argv.includes('-w') || process.argv.includes('--watch')

// spawn('npm', ['run', watch ? 'dev' : 'build', ], {
//   stdio: 'inherit',
// })

exec(`pnpm run build --filter ./packages/${pkg}`)
