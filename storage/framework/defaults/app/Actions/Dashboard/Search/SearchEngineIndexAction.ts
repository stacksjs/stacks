import { Action } from '@stacksjs/actions/runtime'
import { overridesReady, searchEngine } from '@stacksjs/config'
import { resolveModelSources } from '@stacksjs/database/model-sources'
import { searchIndexName, settingsFromSearchTrait, useSearchEngine } from '@stacksjs/search-engine'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError, dashboardOperationalIssue } from '../dashboard-response'

export default new Action({
  name: 'Search Engine Inventory',
  description: 'Inspect the configured search engine and indexes declared by application models.',
  method: 'GET',
  async handle() {
    try {
      await overridesReady
      const models = []
      for (const source of resolveModelSources()?.models ?? []) {
        const module = await import(source.file)
        const Model = await resolveDashboardModel(source.name, module.default ?? module)
        const trait = Model?.traits?.useSearch
        if (!trait) continue
        const settings = settingsFromSearchTrait(typeof trait === 'object' ? trait : {})
        models.push({
          name: source.name,
          index: searchIndexName(trait, Model.table),
          searchable: settings.searchableAttributes ?? ['*'],
          filterable: settings.filterableAttributes ?? [],
          sortable: settings.sortableAttributes ?? [],
          displayed: settings.displayedAttributes ?? ['*'],
        })
      }
      let connected = false
      let unavailable: string | null = null
      let indexes: Array<{ name: string, documents: number | null }> = []
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        const result = await Promise.race([
          Promise.resolve(useSearchEngine().listAllIndexes()),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Search engine inspection timed out.')), 8000) }),
        ])
        if (!Array.isArray(result?.results)) throw new TypeError('Search index response must contain results.')
        indexes = result.results.map(index => {
          const value = index as unknown as Record<string, unknown>
          return { name: String(value.uid), documents: typeof value.num_documents === 'number' ? value.num_documents : null }
        })
        connected = true
      }
      catch (error) {
        dashboardOperationalIssue(error, 'Search engine could not be reached.', 'SearchEngineIndexAction.provider')
        unavailable = 'Search engine could not be reached. Check config/search-engine.ts, provider credentials, and the running service.'
      }
      finally { if (timeout) clearTimeout(timeout) }
      models.sort((a, b) => a.name.localeCompare(b.name))
      return { driver: searchEngine.driver, connected, unavailable, indexes, models }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Search engine inventory could not be loaded.', 'SearchEngineIndexAction')
    }
  },
})
