/**
 * What a record is called, for anywhere the dashboard shows one by name: a
 * picker's list, the link on a record's page, a cell in a related-records
 * panel. One place, so a record has one name everywhere.
 */
import type { ModelOption } from './model-relations'
import { anonymizedRows } from '@stacksjs/orm'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { modelHintColumn, modelLabelColumn } from './model-relations'
import { humanizeIdentifier, isErasureSubject } from './model-write'

/** A model's rows as the options a picker lists: an id, a name, and a line that tells two apart. */
export async function optionsFromRows(Model: any, modelName: string, rows: unknown[]): Promise<ModelOption[]> {
  const labelColumn = modelLabelColumn(Model)
  const hintColumn = modelHintColumn(Model)
  const modelLabel = humanizeIdentifier(modelName)

  // An erased account is stored as placeholders; it is named for what it is.
  const erased = isErasureSubject(Model)
    ? await anonymizedRows(modelName, rows.map(row => ({ id: safeGet(row, 'id', 0), name: safeGet(row, 'name', null), email: safeGet(row, 'email', null), avatar: safeGet(row, 'avatar', null) }))).catch(() => [] as boolean[])
    : []

  return rows.map((row, index) => {
    const id = safeGet(row, 'id', 0) as number | string
    if (erased[index] === true)
      return { id, label: `Anonymized ${modelLabel.toLowerCase()}`, hint: `#${id}` }
    const named = labelColumn ? String(safeGet(row, labelColumn, '') ?? '').trim() : ''
    const hint = hintColumn ? String(safeGet(row, hintColumn, '') ?? '').trim() : ''
    return { id, label: named || `${modelLabel} #${id}`, hint: named ? (hint || `#${id}`) : hint }
  })
}

/**
 * What the records with these ids are called, by id. A model the dashboard
 * cannot reach, or a lookup that fails, answers with nothing: the caller
 * shows the id, which is still true.
 */
export async function recordNames(modelName: string, ids: Array<number | string>): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const wanted = [...new Set(ids.map(id => Number(id)).filter(id => Number.isSafeInteger(id) && id > 0))]
  if (wanted.length === 0)
    return names
  try {
    const Model = await resolveDashboardModel(modelName)
    if (!Model || typeof Model.query !== 'function')
      return names
    const rows = await Model.query().whereIn('id', wanted).get() as unknown[]
    for (const option of await optionsFromRows(Model, modelName, Array.isArray(rows) ? rows : []))
      names.set(String(option.id), option.label)
  }
  catch (error) {
    console.warn(`[dashboard/api] could not name ${modelName} records:`, error)
  }
  return names
}
