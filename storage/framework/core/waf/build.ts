import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })
await rm(new URL('./dist', import.meta.url), { recursive: true, force: true })
await transpilePackage({ dir: import.meta.dir, external: frameworkExternal() })
await outro({ dir: import.meta.dir, startTime, result: { errors: [], warnings: [] } })
