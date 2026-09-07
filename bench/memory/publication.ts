import type { BusyProcess } from '../routing/host-load'
import type { RuntimeRequirement } from '../routing/runtime-version'
import type { SourceState } from '../routing/source'

export interface MemoryPublicationProfile {
  driverPublishable: boolean
  platform: string
  arch: string
  dedicated: boolean
  runtimeRequirement?: RuntimeRequirement
  source?: SourceState
  runs: number
  busyHostProcesses: BusyProcess[]
}

export function memoryPublicationIssues(profile: MemoryPublicationProfile): string[] {
  const issues: string[] = []
  if (!profile.driverPublishable)
    issues.push('load generator is not publishable')
  if (profile.platform !== 'linux')
    issues.push(`host OS is ${profile.platform}, not linux`)
  if (profile.arch !== 'x64')
    issues.push(`host architecture is ${profile.arch}, not x64`)
  if (!profile.dedicated)
    issues.push('BENCH_DEDICATED=1 is not set')
  if (profile.runtimeRequirement?.matches !== true)
    issues.push('runtime does not match package.json engines.bun')
  if (!profile.source?.revision || profile.source.dirty !== false)
    issues.push('source revision is unavailable or the working tree is not clean')
  if (profile.runs < 3)
    issues.push(`only ${profile.runs} fresh-process run(s) were requested; at least 3 are required`)
  if (profile.busyHostProcesses.length > 0)
    issues.push('competing host processes were observed')
  return issues
}
