import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })

await rm('./dist', { recursive: true, force: true })

// Preserve re-exported bindings and one shared schema module across the root,
// runtime, and request-validator entries. Bundling each separately both loses
// bindings on supported Bun versions and duplicates the schema proxy.
await transpilePackage({ dir: import.meta.dir, external: frameworkExternal() })

await outro({ dir: import.meta.dir, startTime, result: { errors: [], warnings: [] } })
