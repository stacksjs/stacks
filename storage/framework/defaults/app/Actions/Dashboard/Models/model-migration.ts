import { tableExists } from '@stacksjs/database/runtime'

/**
 * Whether a model's query failed because its table was never migrated.
 *
 * Asked only after a query has already failed, so a working page pays nothing.
 * The answer comes from the catalog (`tableExists`), not the error's wording.
 * A catalog check that fails too answers `false`, so the original error is
 * reported as it was rather than replaced by a migrate hint.
 *
 * A framework model whose feature an app has not migrated is normal, not an
 * outage: the dashboard lists every model the framework ships, and a fresh
 * app has migrated only some of them. Reporting each as a 503 made every such
 * page look broken and logged a full driver error for it on every request.
 */
export async function isUnmigratedTable(table: string, exists: (table: string) => Promise<boolean> = tableExists): Promise<boolean> {
  try {
    return !(await exists(table))
  }
  catch {
    return false
  }
}
