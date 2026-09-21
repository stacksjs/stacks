// Child for ensure-database-sessions.test.ts. Runs one real probe through the
// default connection factory and reports the result. The parent owns the
// disposable database and reads the server's session counters, so nothing
// here can hold a session open that the parent would count.
import { probeTargetDatabase } from '../../src/ensure-database'
import type { ConnectionTarget } from '../../src/ensure-database'

const target = JSON.parse(process.env.STACKS_PROBE_TARGET ?? '') as ConnectionTarget
const result = await probeTargetDatabase(target)
console.log(JSON.stringify({ ok: result.ok, kind: result.kind, error: result.ok ? undefined : String((result.error as Error | undefined)?.message ?? result.error) }))
