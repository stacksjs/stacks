import { join } from 'node:path'

export interface RuntimeRequirement {
  range: string
  matches: boolean
}

/** Keep the project's requested runtime beside the runtime actually measured. */
export async function readRuntimeRequirement(repoRoot: string, version = Bun.version): Promise<RuntimeRequirement | undefined> {
  const manifest = await Bun.file(join(repoRoot, 'package.json')).json()
  const range = manifest.engines?.bun
  if (typeof range !== 'string' || !range.trim()) return undefined
  return { range, matches: Bun.semver.satisfies(version, range) }
}

export function formatRuntimeRequirement(requirement: RuntimeRequirement): string {
  const range = requirement.range.replaceAll('|', '\\|').replace(/[\r\n]/g, ' ')
  return `${range} (${requirement.matches ? 'matched' : 'runtime mismatch'})`
}

export function runtimeMismatchWarning(requirement: RuntimeRequirement | undefined, version: string): string | undefined {
  if (!requirement || requirement.matches) return undefined
  return `Runtime mismatch: Bun ${version} does not satisfy package.json engines.bun (${requirement.range}). Use the configured runtime or identify this as a runtime comparison.`
}
