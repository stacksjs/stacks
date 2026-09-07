import type { BusyProcess } from './host-load'
import type { RuntimeRequirement } from './runtime-version'
import type { SourceState } from './source'

export interface RoutingPublicationProfile {
  driverPublishable: boolean
  dedicated: boolean
  runtimeRequirement?: RuntimeRequirement
  source?: SourceState
  warmupSeconds: number
  durationSeconds: number
  runs: number
  busyHostProcesses: BusyProcess[]
}

export function routingPublicationIssues(profile: RoutingPublicationProfile): string[] {
  const issues: string[] = []
  if (!profile.driverPublishable)
    issues.push('load generator is not publishable')
  if (!profile.dedicated)
    issues.push('BENCH_DEDICATED=1 is not set')
  if (profile.runtimeRequirement?.matches !== true)
    issues.push('runtime does not match package.json engines.bun')
  if (!profile.source?.revision || profile.source.dirty !== false)
    issues.push('source revision is unavailable or the working tree is not clean')
  if (profile.warmupSeconds < 5)
    issues.push(`warm-up is ${profile.warmupSeconds}s; at least 5s is required`)
  if (profile.durationSeconds < 30)
    issues.push(`measurement window is ${profile.durationSeconds}s; at least 30s is required`)
  if (profile.runs < 3)
    issues.push(`only ${profile.runs} run(s) were requested; at least 3 are required`)
  if (profile.busyHostProcesses.length > 0)
    issues.push('competing host processes were observed')
  return issues
}
