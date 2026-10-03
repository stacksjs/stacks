/**
 * Where probe records live, and how they are read (stacksjs/stacks#877).
 *
 * One JSON file per host and target - `craft-darwin-arm64.json`,
 * `browser-safari-darwin-arm64.json` - so re-measuring overwrites the record it
 * replaces and the diff shows exactly which numbers moved and to which Craft
 * version. Read from disk rather than imported so `--record` needs no code edit.
 */

import type { InteractiveProbeRecord } from './schema'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertProbeRecord } from './schema'

/** The checked-in records, beside this module in the framework repository. */
export const PROBE_RESULTS_DIR: string = fileURLToPath(new URL('./results', import.meta.url))

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** The file a record is stored under. Version is deliberately not part of it. */
export function probeRecordFileName(record: Pick<InteractiveProbeRecord, 'host' | 'os'>): string {
  const host = record.host.kind === 'craft' ? 'craft' : `browser-${slug(record.host.name)}`
  return `${host}-${slug(record.os.platform)}-${slug(record.os.arch)}.json`
}

/** Every record in `dir`, validated, in file-name order. Throws naming the bad file. */
export function loadProbeRecords(dir: string = PROBE_RESULTS_DIR): InteractiveProbeRecord[] {
  let files: string[]
  try {
    files = readdirSync(dir).filter(file => file.endsWith('.json')).sort()
  }
  catch {
    return []
  }
  return files.map((file) => {
    const path = join(dir, file)
    return assertProbeRecord(JSON.parse(readFileSync(path, 'utf8')), path)
  })
}
