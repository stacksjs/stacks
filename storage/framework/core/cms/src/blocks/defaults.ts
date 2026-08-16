import type { BlockDefinition } from './types'
import { schema } from '@stacksjs/validation'
import { defineBlock, registerBlocks } from './registry'

const string = (max = 1000): { validate: (value: unknown) => Promise<boolean> } => ({
  validate: async (value: unknown) => typeof value === 'string' && value.length <= max,
})

const url = (): { validate: (value: unknown) => Promise<boolean> } => ({
  validate: async (value: unknown) => {
    if (typeof value !== 'string' || !value)
      return false
    // Site-relative links are as valid as absolute ones.
    if (value.startsWith('/'))
      return true
    try {
      const result = await schema.string().url().validate(value)
      return typeof result === 'boolean' ? result : Boolean((result as { valid?: boolean }).valid)
    }
    catch {
      return false
    }
  },
})

// eslint-disable-next-line pickier/no-unused-vars -- `value` names the parameter in the returned function type only
const oneOf = (values: string[]): ((value: unknown) => boolean | string) =>
  (value: unknown) => typeof value === 'string' && values.includes(value) ? true : `must be one of ${values.join(', ')}`

/**
 * The block vocabulary every Stacks CMS site starts with. Apps register
 * domain blocks (staff-grid, athletics-schedule, ...) on top and may
 * re-register any of these to change its schema; partials resolve
 * app-dir-first, so overriding the LOOK never needs a re-register.
 */
export const defaultBlocks: BlockDefinition[] = [
  defineBlock({
    type: 'hero',
    label: 'Hero',
    component: 'cms/blocks/hero',
    icon: 'i-hugeicons-layout-top',
    schema: {
      heading: { rule: string(300), required: true },
      subheading: { rule: string(600) },
      imageUrl: { rule: url() },
      ctaLabel: { rule: string(80) },
      ctaHref: { rule: url() },
      align: { rule: oneOf(['left', 'center']) },
    },
  }),

  defineBlock({
    type: 'rich-text',
    label: 'Text',
    component: 'cms/blocks/rich-text',
    icon: 'i-hugeicons-text',
    schema: {
      // Sanitized at render, not at save: the sanitizer's rules can tighten
      // without re-validating stored documents.
      html: { rule: string(100000), required: true },
    },
  }),

  defineBlock({
    type: 'image',
    label: 'Image',
    component: 'cms/blocks/image',
    icon: 'i-hugeicons-image-01',
    schema: {
      src: { rule: url(), required: true },
      alt: { rule: string(300), required: true },
      caption: { rule: string(500) },
      width: { rule: oneOf(['content', 'wide', 'full']) },
    },
  }),

  defineBlock({
    type: 'columns',
    label: 'Columns',
    component: 'cms/blocks/columns',
    icon: 'i-hugeicons-layout-3-column',
    schema: {
      columns: {
        rule: (value: unknown) => Array.isArray(value)
          && value.length >= 1 && value.length <= 4
          && value.every(col => col && typeof col === 'object'
            && typeof (col as { html?: unknown }).html === 'string')
          ? true
          : '1-4 columns, each with an html string',
        required: true,
      },
    },
  }),

  defineBlock({
    type: 'cta',
    label: 'Call to action',
    component: 'cms/blocks/cta',
    icon: 'i-hugeicons-cursor-pointer-02',
    schema: {
      heading: { rule: string(300), required: true },
      body: { rule: string(1000) },
      buttonLabel: { rule: string(80), required: true },
      buttonHref: { rule: url(), required: true },
    },
  }),

  defineBlock({
    type: 'embed',
    label: 'Embed',
    component: 'cms/blocks/embed',
    icon: 'i-hugeicons-embed',
    schema: {
      // Rendered inside a sandboxed iframe by the partial, never inline.
      src: { rule: url(), required: true },
      title: { rule: string(300), required: true },
      aspect: { rule: oneOf(['16:9', '4:3', '1:1']) },
    },
  }),

  defineBlock({
    type: 'form',
    label: 'Form',
    component: 'cms/blocks/form',
    icon: 'i-hugeicons-checklist',
    schema: {
      // Wired to @stacksjs/forms: the partial resolves the definition
      // server-side and renders the fields.
      formUuid: {
        rule: (value: unknown) =>
          typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? true : 'must be a form uuid',
        required: true,
      },
    },
  }),
]

/** Idempotent - both the serving layer and the dashboard call this at boot. */
export function registerDefaultBlocks(): void {
  registerBlocks(defaultBlocks)
}
