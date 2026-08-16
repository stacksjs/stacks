import type { BlockDefinition, BlockError, PageBlock, ValidateBlocksResult } from './types'

/**
 * The block registry: type -> definition. Process-global (Symbol.for-keyed)
 * so the defaults registered by this package and the school-specific blocks
 * an app registers at boot land in one map regardless of module duplication.
 */
const REGISTRY_KEY = Symbol.for('stacks.cms.blockRegistry')
const registry = ((globalThis as Record<symbol, unknown>)[REGISTRY_KEY]
  ??= new Map<string, BlockDefinition>()) as Map<string, BlockDefinition>

export function defineBlock(definition: BlockDefinition): BlockDefinition {
  return definition
}

/** Register blocks. Later registrations win, so an app can replace a default. */
export function registerBlocks(definitions: BlockDefinition[]): void {
  for (const definition of definitions)
    registry.set(definition.type, definition)
}

export function getBlock(type: string): BlockDefinition | undefined {
  return registry.get(type)
}

export function allBlocks(): BlockDefinition[] {
  return [...registry.values()]
}

async function checkProp(definition: BlockDefinition, prop: string, value: unknown): Promise<string | null> {
  const propDef = definition.schema[prop]
  if (!propDef)
    return `unknown prop "${prop}"`

  const rule = propDef.rule
  if (typeof rule === 'function') {
    const result = rule(value)
    if (result === true)
      return null
    return typeof result === 'string' ? result : `invalid value for "${prop}"`
  }

  const valid = await rule.validate(value)
  return valid ? null : `invalid value for "${prop}"`
}

/**
 * Validate an untrusted block document (dashboard save, API write) into a
 * typed one. Unknown block types, unknown props, missing required props and
 * failed rules all reject - a page document is either fully valid or not
 * stored.
 */
export async function validateBlocks(input: unknown): Promise<ValidateBlocksResult> {
  if (!Array.isArray(input))
    return { ok: false, errors: [{ index: -1, message: 'blocks must be an array' }] }

  const errors: BlockError[] = []
  const blocks: PageBlock[] = []

  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ index, message: 'block must be an object' })
      continue
    }

    const candidate = raw as Record<string, unknown>
    const type = typeof candidate.type === 'string' ? candidate.type : ''
    const definition = type ? getBlock(type) : undefined
    if (!definition) {
      errors.push({ index, type, message: type ? `unknown block type "${type}"` : 'block is missing a type' })
      continue
    }

    const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : crypto.randomUUID()
    const props = (candidate.props && typeof candidate.props === 'object' && !Array.isArray(candidate.props))
      ? candidate.props as Record<string, unknown>
      : {}

    for (const [prop, value] of Object.entries(props)) {
      const message = await checkProp(definition, prop, value)
      if (message)
        errors.push({ index, type, prop, message })
    }

    for (const [prop, propDef] of Object.entries(definition.schema)) {
      if (propDef.required && props[prop] === undefined)
        errors.push({ index, type, prop, message: `missing required prop "${prop}"` })
    }

    blocks.push({ id, type, props })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, blocks }
}

/**
 * Parse a stored `blocks` column. Storage is trusted (it passed
 * validateBlocks on the way in), so this only guards shape, not schemas -
 * a render must not 500 because a block type was since unregistered.
 */
export function parseStoredBlocks(stored: unknown): PageBlock[] {
  let value = stored
  if (typeof value === 'string' && value) {
    try {
      value = JSON.parse(value)
    }
    catch {
      return []
    }
  }

  if (!Array.isArray(value))
    return []

  return value.filter((block): block is PageBlock =>
    !!block && typeof block === 'object' && typeof (block as PageBlock).type === 'string')
}
