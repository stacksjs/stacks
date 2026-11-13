/**
 * What a model's list is showing, for a component an app places on that
 * page (`dashboard.regions.listTop` / `listBottom`).
 *
 * ```html
 * <script client>
 * import { useModelList } from '@stacksjs/defaults/views/dashboard/composables/useModelList'
 *
 * const { rows, total, filters } = useModelList()
 * const overdue = derived(() => rows().filter(row => row.status === 'overdue').length)
 * </script>
 * ```
 *
 * Every value is read as a signal, so a component follows the list as it is
 * searched, narrowed and paged.
 */
import type { ModelListFilterValues } from '../../../functions/dashboard-model-filters'
import { modelPageStore } from '../stores/model-page'

export interface ModelListSnapshot {
  /** The rows on the page in view, each its values by column. */
  rows: () => Array<Record<string, unknown>>
  /** How many records match, across every page. */
  total: () => number
  /** What the list is searched for. */
  search: () => string
  /** What the list is narrowed by, by column. */
  filters: () => ModelListFilterValues
  /** The model, as its address has it: `social-post`. Empty off a list. */
  model: () => string
  /** Ask the list to read again, after changing something it shows. */
  reload: () => void
  /**
   * How many times the list has changed a record since the dashboard was
   * opened: a delete, a bulk run, one of the model's actions. Read it in an
   * `effect` to read numbers of your own again. Searching, narrowing and
   * paging do not move it.
   */
  changes: () => number
}

export function useModelList(): ModelListSnapshot {
  return {
    rows: () => modelPageStore.list()?.rows ?? [],
    total: () => modelPageStore.list()?.total ?? 0,
    search: () => modelPageStore.list()?.search ?? '',
    filters: () => modelPageStore.list()?.filters ?? {},
    model: () => modelPageStore.list()?.slug ?? '',
    reload: () => modelPageStore.reloadList(),
    changes: () => modelPageStore.listChanges(),
  }
}
