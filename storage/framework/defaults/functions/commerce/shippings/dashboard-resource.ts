import { dashboardApi } from '../../dashboard-api'
import { readEveryPage } from '../../dashboard-list'
import { pushToast } from '../../toasts'
import { useStorage } from '@stacksjs/browser/composables/useStorage'

interface DashboardResourceRecord {
  id?: number
}

interface DashboardResourceOptions {
  path: string
  storageKey: string
  singular: string
  plural: string
  /**
   * The endpoint answers one page at a time (`{ records, total }`, with
   * `page` and `per_page`) instead of a bare array, as the dashboard's
   * delivery routes do (stacksjs/stacks#3218). `fetchAll` then reads every
   * page, so it still returns every record.
   */
  paged?: boolean
}

export function createDashboardResource<
  TRecord extends DashboardResourceRecord,
  TCreate,
>(options: DashboardResourceOptions) {
  const items = useStorage<TRecord[]>(options.storageKey, [])

  const fetchPages = (): Promise<TRecord[]> => readEveryPage((page, perPage) =>
    dashboardApi<{ records?: TRecord[], total?: number }>(`${options.path}?page=${page}&per_page=${perPage}`))

  async function fetchAll(): Promise<TRecord[]> {
    try {
      const data = options.paged ? await fetchPages() : await dashboardApi<TRecord[]>(options.path)
      if (!Array.isArray(data))
        throw new TypeError('Server returned a non-array response')

      items.value = data
      return data
    }
    catch (error) {
      pushToast('error', `Error fetching ${options.plural}`, { detail: String(error) })
      return []
    }
  }

  async function create(payload: TCreate): Promise<TRecord | null> {
    try {
      const created = await dashboardApi<TRecord>(options.path, {
        method: 'POST',
        body: payload,
      })

      items.value = [...items.value, created]
      return created
    }
    catch (error) {
      pushToast('error', `Error creating ${options.singular}`, { detail: String(error) })
      return null
    }
  }

  async function update(record: TRecord): Promise<TRecord | null> {
    if (record.id === undefined) {
      pushToast('error', `Error updating ${options.singular}`, { detail: 'Record ID is required' })
      return null
    }

    try {
      const updated = await dashboardApi<TRecord>(`${options.path}/${record.id}`, {
        method: 'PATCH',
        body: record,
      })

      items.value = items.value.map(item => item.id === updated.id ? updated : item)
      return updated
    }
    catch (error) {
      pushToast('error', `Error updating ${options.singular}`, { detail: String(error) })
      return null
    }
  }

  async function destroy(id: number): Promise<boolean> {
    try {
      await dashboardApi(`${options.path}/${id}`, { method: 'DELETE' })
      items.value = items.value.filter(item => item.id !== id)
      return true
    }
    catch (error) {
      pushToast('error', `Error deleting ${options.singular}`, { detail: String(error) })
      return false
    }
  }

  return {
    items,
    fetchAll,
    create,
    update,
    destroy,
  }
}
