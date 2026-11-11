import { intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })

// Every declared subpath (meter, service, client, testing) must ship
// executable JavaScript, not just declarations.
await transpilePackage({ dir: import.meta.dir })

await outro({ dir: import.meta.dir, startTime, result: { errors: [], warnings: [] } })
