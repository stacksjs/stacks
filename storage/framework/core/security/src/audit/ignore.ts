import type { Finding, IgnoreEntry } from './types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The project's reviewed exceptions. */
export const IGNORE_FILE = '.security-ignore.json'

export interface LoadedIgnores {
  entries: IgnoreEntry[]
  problems: string[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Read and check `.security-ignore.json`: `{ "ignore": [{ rule, path?, reference?, reason, expires? }] }`. */
export async function loadIgnores(cwd: string, today: string): Promise<LoadedIgnores> {
  let raw: string
  try { raw = await readFile(join(cwd, IGNORE_FILE), 'utf8') }
  catch { return { entries: [], problems: [] } }
  const problems: string[] = []
  let data: any
  try { data = JSON.parse(raw) }
  catch { return { entries: [], problems: [`${IGNORE_FILE} is not valid JSON, so none of its exceptions apply`] } }
  const list: unknown[] = Array.isArray(data?.ignore) ? data.ignore : []
  const entries: IgnoreEntry[] = []
  list.forEach((item: any, index) => {
    const label = `${IGNORE_FILE} entry ${index + 1}${item?.rule ? ` (${item.rule})` : ''}`
    if (!item || typeof item.rule !== 'string' || !item.rule) return void problems.push(`${label} has no rule`)
    if (typeof item.reason !== 'string' || item.reason.trim().length < 8) return void problems.push(`${label} needs a reason of at least a few words`)
    if (item.expires !== undefined && (typeof item.expires !== 'string' || !DATE.test(item.expires))) return void problems.push(`${label} has an expires that is not YYYY-MM-DD`)
    if (item.expires && item.expires < today) return void problems.push(`${label} expired on ${item.expires}; review it and renew or remove it`)
    entries.push({ rule: item.rule, path: item.path, reference: item.reference, reason: item.reason.trim(), expires: item.expires })
  })
  return { entries, problems }
}

function ruleMatches(pattern: string, rule: string): boolean {
  return pattern === rule || pattern === '*' || (pattern.endsWith('/*') && rule.startsWith(pattern.slice(0, -1)))
}

function pathMatches(pattern: string | undefined, file: string | undefined): boolean {
  if (!pattern) return true
  if (!file) return false
  return pattern.endsWith('/') ? file.startsWith(pattern) : file === pattern
}

/** The entry that sets this finding aside, if any. */
export function matchingIgnore(finding: Finding, entries: readonly IgnoreEntry[]): IgnoreEntry | undefined {
  return entries.find(entry =>
    ruleMatches(entry.rule, finding.rule)
    && pathMatches(entry.path, finding.file)
    && (!entry.reference || entry.reference === finding.reference || entry.reference === finding.package))
}
