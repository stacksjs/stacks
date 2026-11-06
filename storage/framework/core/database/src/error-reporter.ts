import type { ErrorReport, ErrorReporter } from '@stacksjs/types'
import process from 'node:process'

/** A bounded, buffered reporter for the dashboard's native Error model table. */
export function createDatabaseErrorReporter(): ErrorReporter {
  let pending = 0
  let writing = Promise.resolve()
  let warned = false
  const warn = (message: string) => {
    if (warned) return
    warned = true
    process.stderr.write(`[error-reporting] Local error storage unavailable: ${message}\n`)
  }
  return {
    name: 'database',
    report(event: ErrorReport) {
      if (pending >= 100) { warn('buffer full; further errors will be dropped until it drains.'); return }
      // Copy only operational metadata. Request bodies, headers and arbitrary
      // context may contain credentials and do not belong in the error store.
      const context: Record<string, unknown> = {}
      for (const key of ['requestId', 'method', 'status', 'label', 'userId']) {
        const value = event.context?.[key]
        if (typeof value === 'string' || typeof value === 'number') context[key] = value
      }
      const row = {
        type: event.error.name || 'Error',
        message: event.error.message,
        stack: event.error.stack ?? '',
        status: typeof event.context?.status === 'number' ? event.context.status : null,
        resolution: 'unresolved' as const,
        additional_info: JSON.stringify(context),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      pending++
      writing = writing.then(async () => {
        const { db } = await import('./runtime')
        await db.insertInto('errors').values(row).execute()
      }).catch((error) => {
        // Never log through report()/log.error here: a failed reporter must
        // not recursively report itself or replace the original exception.
        warn(error instanceof Error ? error.message : String(error))
      }).finally(() => { pending-- })
    },
    async flush() { await writing },
  }
}
