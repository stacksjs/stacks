import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

await rm('./dist', { recursive: true, force: true })

// Preserve named re-exports from ts-cloud. Bun's bundled barrel can drop the
// imported binding even without minification, breaking cloud and its consumers.
// Emitting each module also makes the declared mail server subpaths available.
await transpilePackage({ dir: import.meta.dir, external: frameworkExternal() })

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
