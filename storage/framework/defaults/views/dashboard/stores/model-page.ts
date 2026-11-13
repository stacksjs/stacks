import { defineStore, state } from '@stacksjs/stx'
import type { ModelListFilterValues } from '../../../functions/dashboard-model-filters'
import type { ModelRecord } from '../../../functions/dashboard-model-record'

/** The record a record's page is showing. `record` is null until it has loaded. */
export interface ModelPageRecord {
  /** The model, as its address has it: `social-post`. */
  slug: string
  id: string
  record: ModelRecord | null
}

/** What a model's list is showing now. */
export interface ModelPageList {
  slug: string
  rows: Array<Record<string, unknown>>
  /** How many records match, across every page. */
  total: number
  search: string
  filters: ModelListFilterValues
}

/**
 * What the model page in front of the viewer is showing, for a component the
 * page did not write.
 *
 * A component an app places on a framework page (`dashboard.regions`) is
 * drawn on the server, where a page is the same document at every address.
 * It can be handed its model and nothing that differs by address or changes
 * afterwards. What the page loads, it publishes here, and the component
 * reads it through `useModelRecord()` or `useModelList()`.
 *
 * It is also how the page says which model it is showing, which decides
 * whose components are mounted (`Models/ModelRegionFor.stx`).
 *
 * One page at a time: a page says which record or list it is before it has
 * loaded anything, so a component never shows the page before's.
 */
export const modelPageStore = defineStore('dashboard-model-page', () => {
  const record = state<ModelPageRecord | null>(null)
  const list = state<ModelPageList | null>(null)
  // How to ask the page to read again. Set by the page, called by a component
  // that changed something the page shows.
  let reloadRecord: (() => void) | null = null
  let reloadList: (() => void) | null = null

  return {
    record,
    list,

    /** A record's page has opened. Nothing is known of the record yet. */
    openRecord(slug: string, id: string, reload: () => void): void {
      const shown = record()
      if (!shown || shown.slug !== slug || shown.id !== id)
        record.set({ slug, id, record: null })
      reloadRecord = reload
    },
    /** The record has loaded, or loaded again. */
    showRecord(slug: string, id: string, loaded: ModelRecord | null): void {
      record.set({ slug, id, record: loaded })
    },
    /** The page is gone. Only its own record is cleared, never the next page's. */
    closeRecord(slug: string, id: string): void {
      const shown = record()
      if (shown && shown.slug === slug && shown.id === id) {
        record.set(null)
        reloadRecord = null
      }
    },
    reloadRecord(): void {
      reloadRecord?.()
    },

    /** A model's list has opened. */
    openList(slug: string, reload: () => void): void {
      const shown = list()
      if (!shown || shown.slug !== slug)
        list.set({ slug, rows: [], total: 0, search: '', filters: {} })
      reloadList = reload
    },
    /** The list has loaded, or loaded again. */
    showList(shown: ModelPageList): void {
      list.set(shown)
    },
    closeList(slug: string): void {
      if (list()?.slug === slug) {
        list.set(null)
        reloadList = null
      }
    },
    reloadList(): void {
      reloadList?.()
    },
  }
})
