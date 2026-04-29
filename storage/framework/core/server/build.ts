import { $ } from 'bun'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Compile to standalone binary using `bun build --compile`. Cross-compile for
// Linux x64 (AWS ECS Fargate is the canonical deploy target).
//
// Optional peers (queue/redis driver, tunnel, etc.) need to be marked
// external on the CLI too — without `--external bun-queue`, the bundler
// chases the static import in `@stacksjs/queue/.../redis.ts` and fails the
// compile even though the redis driver is never actually invoked unless the
// project runs `buddy queue:work` against a Redis-backed queue.
console.log('Compiling server to standalone binary for Linux...')

// Build the bun-build CLI args manually — `Bun.spawn` keeps the array
// shape, while the template literal helper doesn't preserve repeated flags
// cleanly. Each external becomes its own `--external <pkg>` pair.
const args = ['build', '--compile', '--minify', '--sourcemap', '--target=bun-linux-x64']
for (const ext of frameworkExternal()) {
  args.push('--external', ext)
}
args.push('./src/start.ts', '--outfile', './dist/server')

const proc = Bun.spawn(['bun', ...args], { stdout: 'inherit', stderr: 'inherit' })
const exitCode = await proc.exited
if (exitCode !== 0) {
  throw new Error(`bun build exited with code ${exitCode}`)
}

console.log('✓ Binary compiled successfully for Linux x64')

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
