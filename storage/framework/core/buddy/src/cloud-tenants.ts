import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Which projects attach to this box is operator knowledge, not framework
 * source. Naming them in a tracked `config/cloud.ts` publishes the customer
 * list of a shared server to everyone who can read the repository, so the list
 * is read from places that never reach it:
 *
 *   1. `STACKS_CLOUD_TENANTS` - comma or whitespace separated slugs. This is
 *      what CI supplies from a secret.
 *   2. `$STACKS_PRIVATE_DIR/tenants.json`, `~/.config/stacks/tenants.json`, then
 *      `storage/cloud/tenants.json` (gitignored, like the rest of that folder).
 *      A JSON array of slugs, or `{ "tenants": [...] }`.
 *   3. `cloud.tenants` in config, still honoured so an existing private fork
 *      keeps working. A public repository should not declare it.
 *
 * Every source is merged; a file that is missing or malformed contributes
 * nothing, because a list that cannot be read must not stop a deploy.
 */
export interface PrivateTenantOptions {
  env?: Record<string, string | undefined>
  cwd?: string
  home?: string
  declared?: unknown
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/

function parseSlugs(value: unknown): string[] {
  const raw = typeof value === 'string' ? value.split(/[\s,]+/) : Array.isArray(value) ? value : []
  return raw.filter((slug): slug is string => typeof slug === 'string').map(slug => slug.trim().toLowerCase()).filter(slug => SLUG.test(slug))
}

function readTenantFile(path: string): string[] {
  if (!existsSync(path)) return []
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return parseSlugs(Array.isArray(parsed) ? parsed : (parsed as { tenants?: unknown })?.tenants)
  }
  catch {
    return []
  }
}

/** Where a private tenant list may live, in the order they are read. */
export function privateTenantFiles(options: PrivateTenantOptions = {}): string[] {
  const env = options.env ?? process.env
  const files: string[] = []
  if (env.STACKS_PRIVATE_DIR) files.push(join(env.STACKS_PRIVATE_DIR, 'tenants.json'))
  files.push(join(options.home ?? homedir(), '.config', 'stacks', 'tenants.json'))
  files.push(join(options.cwd ?? process.cwd(), 'storage', 'cloud', 'tenants.json'))
  return files
}

/** The merged, de-duplicated tenant slugs from every private source and config. */
export function resolvePrivateTenants(options: PrivateTenantOptions = {}): string[] {
  const env = options.env ?? process.env
  const slugs = [
    ...parseSlugs(env.STACKS_CLOUD_TENANTS),
    ...privateTenantFiles(options).flatMap(readTenantFile),
    ...parseSlugs(options.declared),
  ]
  return [...new Set(slugs)].sort()
}
