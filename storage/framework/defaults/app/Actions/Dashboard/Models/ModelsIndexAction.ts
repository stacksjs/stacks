import { Action } from '@stacksjs/actions'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { countRows } from '../../../../resources/functions/dashboard/data'

/**
 * `GET /api/dashboard/models` (stacksjs/stacks#1838).
 *
 * Walks the userland (`app/Models/`) and framework default
 * (`storage/framework/defaults/app/Models/`) trees, loads each model,
 * counts its rows, and returns a grouped JSON shape for the
 * `views/dashboard/models/index.stx` page to render.
 *
 * Previously this work happened inline in the page's `<script server>`
 * block — converting the page to `<script client>` for the #1838 sweep
 * required moving the file-walk + count work to a real endpoint since
 * neither `node:fs` nor `loadModel` work in the browser.
 *
 * Userland wins on name collision: a project that overrides a default
 * `User` in `app/Models/` sees its own row, not both.
 */
interface ModelRow {
  name: string
  table: string
  href: string
  count: number | null
  attributeCount: number
  category: string
  source: 'userland' | 'framework'
  apiUri: string
  apiRoutes: string[]
  error: string | null
}

interface ModelGroup {
  key: string
  label: string
  models: ModelRow[]
  countLabel: string
}

function pascalToSnake(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

function pascalToKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

function walkModels(dir: string, recursive: boolean): Array<{ name: string, file: string }> {
  const out: Array<{ name: string, file: string }> = []
  if (!existsSync(dir))
    return out

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) {
      if (recursive) out.push(...walkModels(full, true))
      continue
    }
    if (!ent.name.endsWith('.ts')) continue
    if (ent.name.startsWith('_') || ent.name === 'index.ts' || ent.name === 'README.ts') continue
    out.push({ name: ent.name.replace('.ts', ''), file: full })
  }
  return out
}

function categorize(model: { source: 'userland' | 'framework', file: string }): string {
  if (model.source === 'userland') return 'userland'
  const segs = model.file.split('/Models/')[1]?.split('/') ?? []
  if (segs.length > 1) return segs[0].toLowerCase()
  return 'framework'
}

const orderedCategories = ['userland', 'framework', 'commerce', 'content', 'marketing', 'realtime']

function categoryOrder(k: string): number {
  const idx = orderedCategories.indexOf(k)
  return idx === -1 ? orderedCategories.length : idx
}

function categoryLabel(k: string): string {
  return k === 'userland' ? 'Your Models' : k.charAt(0).toUpperCase() + k.slice(1)
}

export default new Action({
  name: 'Dashboard Models Index',
  description: 'List every model + live record count for the dashboard models overview.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const cwd = process.cwd()
    const userlandDir = join(cwd, 'app', 'Models')
    const defaultsDir = join(cwd, 'storage/framework/defaults/app/Models')

    const userland = walkModels(userlandDir, false)
    const defaults = walkModels(defaultsDir, true)

    const seen = new Set<string>()
    const merged: Array<{ name: string, file: string, source: 'userland' | 'framework' }> = []
    for (const list of [userland, defaults]) {
      for (const m of list) {
        if (seen.has(m.name)) continue
        seen.add(m.name)
        merged.push({ ...m, source: list === userland ? 'userland' : 'framework' })
      }
    }

    const enriched = await Promise.all(merged.map(async (m): Promise<ModelRow> => {
      let Model: any
      try {
        const module = await import(m.file)
        Model = module.default ?? module
      }
      catch (error) {
        return {
          name: m.name,
          table: pluralize(pascalToSnake(m.name)),
          href: `/models/${pascalToKebab(m.name)}`,
          count: null,
          attributeCount: 0,
          category: categorize(m),
          source: m.source,
          apiUri: '',
          apiRoutes: [],
          error: error instanceof Error ? error.message : String(error),
        }
      }

      const api = Model.traits?.useApi
      let count: number | null = null
      let error: string | null = null
      try {
        count = await countRows(Model)
      }
      catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause)
      }

      return {
        name: m.name,
        table: String(Model.table || pluralize(pascalToSnake(m.name))),
        href: `/models/${pascalToKebab(m.name)}`,
        count,
        attributeCount: Object.keys(Model.attributes || {}).length,
        category: categorize(m),
        source: m.source,
        apiUri: typeof api === 'object' && typeof api.uri === 'string' ? `/api/${api.uri}` : '',
        apiRoutes: typeof api === 'object' && Array.isArray(api.routes) ? api.routes.map(String) : [],
        error,
      }
    }))

    enriched.sort((a, b) => a.name.localeCompare(b.name))

    const totalModels = enriched.length
    const totalRecords = enriched.reduce((sum, m) => sum + (m.count ?? 0), 0)
    const userlandCount = enriched.filter(m => m.source === 'userland').length
    const unavailableModels = enriched.filter(m => m.error !== null).length

    const groupMap: Record<string, ModelRow[]> = {}
    for (const m of enriched) {
      if (!groupMap[m.category]) groupMap[m.category] = []
      groupMap[m.category].push(m)
    }

    const categoryGroups: ModelGroup[] = Object.keys(groupMap)
      .sort((a, b) => categoryOrder(a) - categoryOrder(b))
      .map(key => ({
        key,
        label: categoryLabel(key),
        models: groupMap[key],
        countLabel: `${groupMap[key].length} model${groupMap[key].length === 1 ? '' : 's'}`,
      }))

    return {
      totalModels,
      totalRecords,
      userlandCount,
      unavailableModels,
      categoryGroups,
    }
  },
})
