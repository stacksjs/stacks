import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })

// The launcher and probe runner are compiled by their consumers. Preserve all
// modules so public subpaths such as support and probe share the same graph.
await rm('./dist', { recursive: true, force: true })
await transpilePackage({ dir: import.meta.dir, external: frameworkExternal() })

await outro({ dir: import.meta.dir, startTime, result: { errors: [], warnings: [] } })
