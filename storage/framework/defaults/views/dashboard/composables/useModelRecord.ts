/**
 * The record a record's page is showing, for a component an app places on
 * that page (`dashboard.regions.recordTop` / `recordBottom`).
 *
 * ```html
 * <script client>
 * import { useModelRecord } from '@stacksjs/defaults/views/dashboard/composables/useModelRecord'
 *
 * const { record, reload } = useModelRecord()
 * const shipped = derived(() => record()?.status === 'shipped')
 * </script>
 * ```
 *
 * Every value is read as a signal, so a component follows the page: null
 * while the record loads, then the record, and the new one when the page
 * reads it again after an action.
 */
import type { ModelRecord } from '../../../functions/dashboard-model-record'
import { modelPageStore } from '../stores/model-page'

export interface ModelRecordSnapshot {
  /** The record's values by column (`{ id: 7, name: 'Northwind', team_id: 3 }`), or null until it has loaded. */
  record: () => Record<string, unknown> | null
  /**
   * Everything the page was told about the record: its values, what its
   * columns are called, the records it points at by name, and what may be
   * done to it. Null until it has loaded.
   */
  details: () => ModelRecord | null
  /** The model, as its address has it: `social-post`. Empty off a record's page. */
  model: () => string
  /** The record's id, from the address. Known before the record has loaded. */
  id: () => string
  /** Ask the page to read the record again, after changing something it shows. */
  reload: () => void
}

export function useModelRecord(): ModelRecordSnapshot {
  return {
    record: () => modelPageStore.record()?.record?.row ?? null,
    details: () => modelPageStore.record()?.record ?? null,
    model: () => modelPageStore.record()?.slug ?? '',
    id: () => modelPageStore.record()?.id ?? '',
    reload: () => modelPageStore.reloadRecord(),
  }
}
