/** Read model declarations to plan fixture dependencies, never query or seed. */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { loadModelRegistry, modelFiles } from '@stacksjs/orm/model-registry'

export interface ScreenshotModel {
  name: string
  table?: string
  primaryKey: string
  api?: string
  parents: string[]
  seederCount: number | null
  factoryFields: string[]
  defaultFields: string[]
  requiredWithoutFactory: string[]
  sensitiveFields: string[]
  suggestedStates: string[]
}
export interface ScreenshotModelPlan {
  models: ScreenshotModel[]
  /** Parent models first; cycles remain explicit rather than using fake ids. */
  creationOrder: string[]
  cycles: string[]
  blocked: string[]
  externalParents: string[]
  sourceHash?: string
}
export interface ScreenshotModelOptions { directory?: string, includeDefaults?: boolean }
export type ScreenshotFixtures = Record<string, Record<string, string | number>>

type Definition = Record<string, any>

/** Metadata only: factories are detected, never executed by the planner. */
export function planScreenshotModels(definitions: Record<string, Definition>): ScreenshotModelPlan {
  const models: ScreenshotModel[] = Object.entries(definitions).map(([key, model]) => {
    const attributes = Object.entries(model.attributes ?? {}) as Array<[string, Definition]>
    const belongsTo = model.belongsTo ?? []
    const relationships: unknown[] = Array.isArray(belongsTo) ? belongsTo : Object.values(belongsTo)
    const parents = relationships.map(relation => typeof relation === 'string' ? relation : relation && typeof relation === 'object' ? String((relation as Definition).model ?? (relation as Definition).name ?? '') : '').filter(Boolean)
    const api = model.traits?.useApi
    const seeder = model.traits?.useSeeder ?? model.traits?.seedable
    const sensitive = (name: string, attribute: Definition): boolean => Boolean(attribute.hidden || attribute.encrypted || attribute.personal || /password|token|secret|api.?key|email|phone|address/i.test(name))
    const requiredWithoutFactory = attributes.filter(([, attribute]) => attribute.required && !attribute.nullable && typeof attribute.factory !== 'function' && !Object.hasOwn(attribute, 'default')).map(([name]) => name)
    return {
      name: String(model.name ?? key), table: model.table, primaryKey: String(model.primaryKey ?? 'id'),
      ...(api?.uri ? { api: String(api.uri) } : {}), parents: [...new Set([...parents, ...(Array.isArray(seeder?.after) ? seeder.after.map(String) : [])])].sort(),
      seederCount: typeof seeder?.count === 'number' ? seeder.count : null,
      factoryFields: attributes.filter(([, attribute]) => typeof attribute.factory === 'function').map(([name]) => name),
      defaultFields: attributes.filter(([, attribute]) => Object.hasOwn(attribute, 'default')).map(([name]) => name),
      requiredWithoutFactory,
      sensitiveFields: attributes.filter(([name, attribute]) => sensitive(name, attribute)).map(([name]) => name),
      suggestedStates: [...new Set(['empty', 'populated', ...(api?.routes?.includes('show') ? ['detail'] : []), ...(api?.middleware?.length ? ['permission-denied'] : []), ...(model.traits?.useSoftDeletes || model.traits?.softDeletable ? ['archived'] : [])])],
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
  const names = new Set(models.map(model => model.name))
  const pending = new Map(models.map(model => [model.name, model]))
  const creationOrder: string[] = []
  for (;;) {
    const ready = [...pending.values()].filter(model => model.parents.every(parent => !names.has(parent) || creationOrder.includes(parent)))
    if (!ready.length) break
    for (const model of ready) { creationOrder.push(model.name); pending.delete(model.name) }
  }
  const cycleNames = new Set<string>()
  const visited = new Set<string>()
  function visit(name: string, stack: string[]): void {
    const at = stack.indexOf(name)
    if (at >= 0) { for (const member of stack.slice(at)) cycleNames.add(member); return }
    if (visited.has(name)) return
    for (const parent of pending.get(name)?.parents ?? []) if (pending.has(parent)) visit(parent, [...stack, name])
    visited.add(name)
  }
  for (const name of pending.keys()) visit(name, [])
  return { models, creationOrder, cycles: [...cycleNames].sort(), blocked: [...pending.keys()].filter(name => !cycleNames.has(name)), externalParents: [...new Set(models.flatMap(model => model.parents).filter(parent => !names.has(parent)))].sort() }
}

export async function discoverScreenshotModels(root: string, options: ScreenshotModelOptions | false = {}): Promise<ScreenshotModelPlan> {
  if (options === false) return planScreenshotModels({})
  if (options.directory !== undefined && !options.directory.trim()) throw new Error('Model directory must not be empty')
  const userRoot = resolve(root, options.directory ?? 'app/Models')
  if (isAbsolute(options.directory ?? '') || relative(root, userRoot).split(/[\\/]/)[0] === '..') throw new Error('Model directory must be inside the project')
  const defaultsRoot = options.includeDefaults ? join(root, 'storage/framework/defaults/app/Models') : undefined
  if (!existsSync(userRoot) && !defaultsRoot) return planScreenshotModels({})
  const failures: string[] = []
  const definitions = await loadModelRegistry({ userRoot, defaultsRoot, onImportError: file => failures.push(file) })
  if (failures.length) throw new Error(`Cannot inspect screenshot models: ${failures.join(', ')}`)
  const plan = planScreenshotModels(definitions)
  const files = [...modelFiles(userRoot), ...(defaultsRoot ? modelFiles(defaultsRoot) : [])].sort()
  plan.sourceHash = createHash('sha256').update(Buffer.concat(await Promise.all(files.map(file => readFile(file))))).digest('hex')
  return plan
}

/** Bind concrete fixture fields to [id], [slug], or :id route parameters. */
export function screenshotFixturePath(path: string, model: string | undefined, fixtures: ScreenshotFixtures, plan: ScreenshotModelPlan): string {
  if (!/\[[^\]]+\]|:[a-z][\w]*(?=\/|$|[?#])/i.test(path)) return path
  const candidates = model ? plan.models.filter(item => item.name === model) : plan.models.filter(item => item.api && path.replace(/^\//, '').startsWith(`${item.api.replace(/^\//, '')}/`))
  const candidate = candidates.length === 1 ? candidates[0] : undefined
  if (!candidate) throw new Error('A dynamic screenshot route needs an explicit model or an unambiguous model API URI')
  const row = fixtures[candidate.name]
  if (!row) throw new Error(`No screenshot fixture supplied for ${candidate.name}`)
  return path.replace(/\[([^\]]+)\]|:([a-z][\w]*)(?=\/|$|[?#])/gi, (_match, bracket: string, colon: string) => {
    const key = bracket || colon
    const field = key === 'id' ? candidate.primaryKey : key
    if (candidate.sensitiveFields.includes(field) || /token|secret|password/i.test(key)) throw new Error(`Refusing to publish a sensitive route parameter: ${key}`)
    const value = row[field]
    if (value === undefined || value === '' || (typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`Screenshot fixture ${candidate.name} has no ${key}`)
    return encodeURIComponent(String(value))
  })
}
