/**
 * The events models emit, as types.
 *
 * `storage/framework/types/events.d.ts` carried a banner saying it defined
 * "the event types emitted by models" and was written by nothing, so it drifted
 * in three directions at once:
 *
 *  1. Every payload was `Record<string, any>`, and its own docblock told you to
 *     "cast to your model's attribute type at the listener site" - which is the
 *     type declining to do the one thing it exists for.
 *  2. It listed three events per model. Models emit EIGHT: `saving`,
 *     `creating`/`updating`/`deleting`, then `created`/`updated`/`deleted` and
 *     `saved`. `listen('user:saved', …)` was not a known event at all.
 *  3. It listed whichever models existed when somebody last edited it.
 *
 * Generated now, from the models on disk, with the real row type behind each
 * payload.
 *
 * Written as `events.ts`, not `events.d.ts`. Both existed, tracked, side by
 * side, and TypeScript prefers the `.ts` - so an edit to the declaration file
 * was read by nothing, which is how two copies of the same interface drifted
 * apart without anybody noticing.
 *
 * ## Before and after carry different things
 *
 * `define-model.ts` dispatches the before-events with the model object and the
 * after-events with `toEventPayload(model)`, which returns `{...attributes}`
 * plus the primary key. So an after-listener receives the row and a
 * before-listener receives the object the row lives on - `toEventPayload`
 * reading `model?.attributes` is the proof that it does. The before-events are
 * typed as much as that establishes and no further.
 */

import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'

/** Fired before the write, with the model object; returning `false` cancels. */
const BEFORE_EVENTS = ['saving', 'creating', 'updating', 'deleting'] as const

/** Fired after the write, with the row. */
const AFTER_EVENTS = ['created', 'updated', 'saved', 'deleted'] as const

/**
 * Where models live, in override order - the application's own first, the
 * framework defaults behind it, matching how the ORM resolves them.
 */
function modelDirectories(): string[] {
  const candidates = [
    p.appPath('Models'),
    p.storagePath('framework/defaults/app/Models'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    candidates.push(`${pkgJson.slice(0, pkgJson.lastIndexOf('/'))}/app/Models`)
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  return candidates.filter(dir => existsSync(dir))
}

/**
 * The models this application has, by the global name the ORM exposes them
 * under.
 *
 * The file name is the global: `Models/commerce/Product.ts` is `Product`, which
 * `server-auto-imports.d.ts` declares. Reading the name off the file rather
 * than importing the module keeps this a filesystem scan - importing 60 model
 * definitions to generate a declaration file would run every `defineModel()`
 * for a list of names already written on disk.
 */
interface DiscoveredModel {
  /** The model's name, which is its file name. */
  name: string
  /** Import specifier relative to `storage/framework/types/`. */
  specifier: string
}

async function collectModels(): Promise<DiscoveredModel[]> {
  const found = new Map<string, DiscoveredModel>()

  for (const dir of modelDirectories()) {
    const files = await readdir(dir, { recursive: true })
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts'))
        continue

      const name = file.slice(file.lastIndexOf('/') + 1, -3)
      // A model's exported name is its file name; anything that is not a valid
      // identifier is not one.
      if (!/^[A-Z][\w$]*$/.test(name))
        continue

      // First directory wins, which is the override order above.
      if (found.has(name))
        continue

      const absolute = `${dir}/${file.slice(0, -3)}`
      found.set(name, { name, specifier: relativeToTypes(absolute) })
    }
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * An import specifier for `absolute`, relative to `storage/framework/types/`.
 *
 * Computed rather than assumed, because a model in `app/Models/` overrides one
 * of the same name under the framework defaults and the two are at different
 * depths - so the specifier has to follow whichever file actually won.
 */
function relativeToTypes(absolute: string): string {
  const from = p.frameworkPath('types').split('/').filter(Boolean)
  const to = absolute.split('/').filter(Boolean)

  let shared = 0
  while (shared < from.length && shared < to.length && from[shared] === to[shared])
    shared++

  const up = Array.from({ length: from.length - shared }, () => '..')
  const down = to.slice(shared)
  return [...up, ...down].join('/')
}

/** `'ProductCategory'` → `'productcategory'`, matching `definition.name.toLowerCase()`. */
function eventPrefix(model: string): string {
  return model.toLowerCase()
}

/**
 * Write `storage/framework/types/model-events.d.ts`.
 */
export async function generateEventTypes(): Promise<void> {
  log.info('Generating event types...')

  const models = await collectModels()

  if (models.length === 0) {
    log.debug('[generate:types] No model directories found; leaving model-events.d.ts alone')
    return
  }

  const entries: string[] = []
  for (const model of models) {
    const prefix = eventPrefix(model.name)
    /*
     * The bare global `User`, which `server-auto-imports.d.ts` declares.
     *
     * Naming the module instead (`typeof import('…/Models/User')['default']`)
     * looks more self-contained and is worse: it drags all 97 model modules
     * into every project that reads this file, including the ORM's own
     * type-test project, where `@stacksjs/orm` resolves to a built dist and the
     * models cannot compile at all.
     */
    const definition = `typeof ${model.name}`
    for (const event of BEFORE_EVENTS)
      entries.push(`    '${prefix}:${event}': ModelWriteEvent<${definition}>`)
    for (const event of AFTER_EVENTS)
      entries.push(`    '${prefix}:${event}': ModelRow<${definition}>`)
  }

  const contents = `// This file is auto-generated by Stacks. Do not edit this file manually.
//
// The events every model emits, with the row type behind each payload. Rebuilt
// by \`buddy generate:types\` from the models on disk - add a model and its
// eight events appear here; rename one and the old names stop compiling.
//
// An augmentation rather than a plain interface, and it lives in the
// application's own declarations rather than in \`@stacksjs/types\`: naming a
// model row is only possible in a compilation that has the model globals, and
// \`@stacksjs/types\` is reached by the ORM's type-test project, where
// \`@stacksjs/orm\` resolves to a built dist and the models cannot compile.

declare module '@stacksjs/events' {
  /**
   * What a BEFORE event carries: the model object, not the row.
   *
   * \`define-model.ts\` hands \`saving\`/\`creating\`/\`updating\`/\`deleting\` the
   * model itself and converts to the row only for the after-events;
   * \`toEventPayload\` reading \`model?.attributes\` is what establishes that the
   * object has one. Typed as far as that goes and no further - the rest of the
   * instance belongs to the query builder.
   *
   * Returning \`false\` from one of these listeners cancels the write.
   */
  interface ModelWriteEvent<TModel> {
    attributes: ModelRow<TModel>
    [key: string]: unknown
  }

  /**
   * Every model event this application can listen for.
   *
   * \`'user:created'\` used to be \`Record<string, any>\`, and the declaration
   * told you to "cast to your model's attribute type at the listener site" -
   * the type declining to do the one thing it exists for. It is the User row.
   */
  interface AppEvents {
${entries.join('\n')}
  }
}

export {}
`

  await storage.writeFile(p.frameworkPath('types/model-events.d.ts'), contents)
  log.debug(`[generate:types] Wrote ${models.length} models × ${BEFORE_EVENTS.length + AFTER_EVENTS.length} events`)
}
