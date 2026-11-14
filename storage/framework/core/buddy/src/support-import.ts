import type { HqServicesConfig } from '@stacksjs/types'
import { stat, readFile } from 'node:fs/promises'
import { basename } from 'node:path'

export interface SupportImportOptions { file?: string, dryRun?: boolean, resume?: string, status?: string }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }

/** Full source data travels only to the selected service, never terminal output. */
export async function runSupportImport(config: HqServicesConfig, options: SupportImportOptions, deps: { fetch: (input: string, init?: RequestInit) => Promise<Response>, print: (line: string) => void }): Promise<boolean> {
  const service = config.supporthq
  if (!service?.key || !service.project) { deps.print('Connect HQ.support with buddy support:install first.'); return false }
  try {
    if ([Boolean(options.file), Boolean(options.resume), Boolean(options.status)].filter(Boolean).length !== 1 || (options.dryRun && !options.file)) throw new Error('Choose one operation')
    const base = new URL(service.url)
    if (base.username || base.password || base.search || base.hash || base.pathname !== '/' || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Invalid service')
    const endpoint = `${base.origin}/api/v1/projects/${encodeURIComponent(service.project)}/imports`
    let path: string, body: BodyInit | undefined, method = 'POST'
    if (options.file) {
      const metadata = await stat(options.file)
      if (!metadata.isFile() || metadata.size < 1 || metadata.size > 10000000 || !/\.json$/i.test(options.file)) throw new Error('Invalid bundle file')
      const bytes = await readFile(options.file)
      const form = new FormData()
      form.append('file', new File([bytes], basename(options.file), { type: 'application/json' }))
      if (options.dryRun) form.append('dryRun', 'true')
      body = form
      path = `${endpoint}/intercom`
    }
    else {
      const id = options.resume ?? options.status
      if (!id || !/^\d+$/.test(id)) throw new Error('Invalid run id')
      path = `${endpoint}/${id}${options.resume ? '/resume' : ''}`
      if (options.status) method = 'GET'
    }
    const response = await deps.fetch(path, { method, headers: { Authorization: `Bearer ${service.key}`, Accept: 'application/json' }, body, redirect: 'error', signal: AbortSignal.timeout(120000) })
    if (!response.ok) { deps.print(`HQ.support refused the migration operation (${response.status}). Review the bundle or saved run before retrying.`); return false }
    const result: unknown = await response.json()
    if (!record(result)) throw new Error('Invalid result')
    if (options.dryRun) {
      if (result.dryRun !== true || !['totalRecords', 'compatibleRecords', 'skippedRecords', 'reviewRecords'].every(key => count(result[key])) || !Array.isArray(result.reasons)) throw new Error('Invalid preview')
      deps.print(`Preview: ${result.totalRecords} records; ${result.compatibleRecords} compatible, ${result.skippedRecords} unchanged, ${result.reviewRecords} require review. No customer data was imported.`)
      for (const reason of result.reasons) {
        if (!record(reason) || typeof reason.code !== 'string' || !/^[a-z0-9_]+$/.test(reason.code) || !count(reason.count)) throw new Error('Invalid reason')
        deps.print(`${reason.code}: ${reason.count}`)
      }
    }
    else {
      const run = result.run
      if (!record(run) || typeof run.id !== 'string' || !/^\d+$/.test(run.id) || typeof run.status !== 'string' || !/^[a-z_]+$/.test(run.status) || !['totalRecords', 'processed', 'imported', 'skipped', 'failed'].every(key => count(run[key]))) throw new Error('Invalid run')
      deps.print(`Migration ${run.id}: ${run.status}; ${run.processed}/${run.totalRecords} processed, ${run.imported} imported, ${run.skipped} unchanged, ${run.failed} require review.`)
      deps.print(`Inspect: buddy support:import intercom --status ${run.id}`)
    }
    return true
  }
  catch {
    deps.print('Migration could not be confirmed. Use one JSON bundle up to 10 MB, or a saved run ID. Retry the same bundle to deduplicate; customer bodies and keys are not printed.')
    return false
  }
}
