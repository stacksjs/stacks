import { intro, outro } from '../build/src'
import { $ } from 'bun'

const { startTime} = await intro({
  dir: import.meta.dir,
})

// Compile to standalone binary using bun build --compile
// Cross-compile for Linux x64 (AWS ECS Fargate)
console.log('Compiling server to standalone binary for Linux...')

await $`bun build --compile --minify --sourcemap --target=bun-linux-x64 ./src/start.ts --outfile ./dist/server`

console.log('✓ Binary compiled successfully for Linux x64')

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
