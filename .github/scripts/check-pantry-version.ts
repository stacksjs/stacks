import { resolve } from 'node:path'
import { resolvePantryToolchain } from '../../storage/framework/core/actions/src/pantry-toolchain'

// The publisher invokes pantry on PATH. A local-release PANTRY_BIN override
// must not make a different publisher executable pass this check.
const result = resolvePantryToolchain({ cwd: resolve(import.meta.dir, '../..'), env: {} })
if (!result.ok) {
  console.error(result.message)
  process.exitCode = 1
}
else if (!result.declared) {
  console.error('Publisher Pantry SDK range is missing from the framework manifest')
  process.exitCode = 1
}
else {
  console.log(`Publisher Pantry ${result.version} satisfies ts-pantry ${result.declared}`)
}
