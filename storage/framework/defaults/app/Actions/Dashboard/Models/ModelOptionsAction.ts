import type { RequestInstance } from '@stacksjs/types'
import type { ModelOption } from './model-relations'
import { Action } from '@stacksjs/actions/runtime'
import { anonymizedRows } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError } from '../dashboard-response'
import { modelHintColumn, modelLabelColumn } from './model-relations'
import { humanizeIdentifier, isErasureSubject, isValidModelSlug, slugToPascal } from './model-write'

/** How many records a search offers. A picker is for finding one, not browsing. */
const OPTION_LIMIT = 20
/** How many ids one request may ask the names of. */
const ID_LIMIT = 50

interface OptionsInput {
  q?: unknown
  ids?: unknown
}

function parseIds(raw: unknown): number[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
  const ids = parts.map(part => Number.parseInt(String(part).trim(), 10)).filter(id => Number.isSafeInteger(id) && id > 0)
  return [...new Set(ids)].slice(0, ID_LIMIT)
}

/**
 * `GET /api/dashboard/models/{slug}/options`.
 *
 * The records of a model as a picker lists them: an id and what the record
 * is called. `?q=` searches by that name (and by a person's email, and by id
 * when the term is a number); `?ids=3,7` answers for exactly those, which is
 * how a form shows the name of the record a field already points at.
 *
 * Its own endpoint, not the model browser's: that one returns every column of
 * every row it matches, and a picker asks on every keystroke.
 */
export default new Action({
  name: 'Dashboard Model Options',
  description: 'Lists a model\'s records by name, for choosing one in a form.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance<OptionsInput>) {
    const slug = String(request.getParam('slug') ?? '')
    if (!isValidModelSlug(slug))
      return response.json({ message: 'Model slug must be lowercase kebab-case.' }, 400)

    const modelName = slugToPascal(slug)
    let Model: any
    try {
      Model = await resolveDashboardModel(modelName)
    }
    catch (error) {
      return dashboardOperationalError(error, `${modelName} could not be loaded.`, 'ModelOptionsAction.resolve')
    }
    if (!Model || typeof Model.where !== 'function')
      return response.json({ message: `No ORM model named ${modelName}.` }, 404)

    const input = request.all()
    const q = String(input.q ?? '').trim().slice(0, 100)
    const ids = parseIds(input.ids)
    const labelColumn = modelLabelColumn(Model)
    const hintColumn = modelHintColumn(Model)
    const modelLabel = humanizeIdentifier(modelName)

    try {
      // Built the way the model browser builds its search: from the model's
      // own query, with raw conditions inside the group.
      let query = Model.query() as any
      if (ids.length > 0) {
        query = query.whereIn('id', ids)
      }
      else if (q) {
        const numeric = /^\d+$/.test(q) ? Number(q) : null
        const conditions: Array<[string, string | number]> = [labelColumn, hintColumn]
          .filter((column): column is string => Boolean(column))
          // Lowercased on both sides: a model query's LIKE is case-sensitive
          // on PostgreSQL (stacksjs/stacks#3202).
          .map(column => [`LOWER(${column}) LIKE LOWER(?)`, `%${q}%`])
        if (numeric !== null)
          conditions.push(['id = ?', numeric])
        // Nothing to search by name and the term is not an id: no match, not everything.
        if (conditions.length === 0)
          return { options: [], modelLabel, labelColumn }
        query = query.whereGroup((group: any) => {
          for (const [index, [condition, value]] of conditions.entries())
            group = index === 0 ? group.whereRaw(condition, value) : group.orWhereRaw(condition, value)
          return group
        })
      }

      const rows = await query.orderBy(labelColumn ?? 'id', 'asc').take(ids.length > 0 ? ID_LIMIT : OPTION_LIMIT).get() as any[]
      const list = Array.isArray(rows) ? rows : []

      // An erased account is stored as placeholders; a picker names it for what it is.
      const erased = isErasureSubject(Model)
        ? await anonymizedRows(modelName, list.map(row => ({ id: safeGet(row, 'id', 0), name: safeGet(row, 'name', null), email: safeGet(row, 'email', null), avatar: safeGet(row, 'avatar', null) }))).catch(() => [] as boolean[])
        : []

      const options: ModelOption[] = list.map((row, index) => {
        const id = safeGet(row, 'id', 0) as number | string
        if (erased[index] === true)
          return { id, label: `Anonymized ${modelLabel.toLowerCase()}`, hint: `#${id}` }
        const named = labelColumn ? String(safeGet(row, labelColumn, '') ?? '').trim() : ''
        const hint = hintColumn ? String(safeGet(row, hintColumn, '') ?? '').trim() : ''
        return { id, label: named || `${modelLabel} #${id}`, hint: named ? (hint || `#${id}`) : hint }
      })

      return { options, modelLabel, labelColumn }
    }
    catch (error) {
      return dashboardOperationalError(error, `${modelLabel} records could not be listed.`, 'ModelOptionsAction.query')
    }
  },
})
