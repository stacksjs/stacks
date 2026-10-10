import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })
await rm('./dist', { recursive: true, force: true })
// Every declared narrow entry must ship runtime code as well as declarations.
// Multi-entry bundling dropped reused inventory/tax-input exports from the
// standalone artifacts. One module per source file preserves that contract.
await transpilePackage({ dir: import.meta.dir, external: frameworkExternal() })
await outro({ dir: import.meta.dir, startTime, result: { errors: [], warnings: [] } })
