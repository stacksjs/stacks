/** One block in a page document: stable id, registered type, typed props. */
export interface PageBlock {
  id: string
  type: string
  props: Record<string, unknown>
}

/**
 * A prop validator: return true for valid, or a message for invalid. Kept
 * structural (not tied to ts-validation's class) so block schemas can use
 * `schema.*` rules or plain functions interchangeably.
 */
export type BlockPropRule
  = | { validate: (value: unknown) => boolean | Promise<boolean> }
    | ((value: unknown) => boolean | string)

export interface BlockPropDefinition {
  rule: BlockPropRule
  required?: boolean
}

export interface BlockDefinition {
  /** Registry key, kebab-case: `hero`, `rich-text`, `form`. */
  type: string
  /** Editor-facing name. */
  label: string
  /**
   * The stx partial that renders it, relative to the views root:
   * `cms/blocks/hero` - app partials override by the usual app-dir-wins rule.
   */
  component: string
  /** Per-prop validation. Unknown props are rejected outright. */
  schema: Record<string, BlockPropDefinition>
  /** Iconify class for the editor palette. */
  icon?: string
}

export interface BlockError {
  index: number
  type?: string
  prop?: string
  message: string
}

export type ValidateBlocksResult
  = | { ok: true, blocks: PageBlock[] }
    | { ok: false, errors: BlockError[] }
