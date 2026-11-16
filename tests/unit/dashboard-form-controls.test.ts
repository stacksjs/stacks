import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A dialog asks for a value with the dashboard's shared controls
 * (stacksjs/stacks#3310).
 *
 * The commerce dialogs wrote 166 inputs, dropdowns and text areas of their
 * own, each with its own classes, where a model's form uses
 * `Dashboard/UI/Input.stx`, `Select.stx` and `Textarea.stx`. They are the
 * shared ones now, so a field looks and behaves the same wherever it is.
 */
const DASHBOARD = join(import.meta.dir, '../../storage/framework/defaults/resources/components/Dashboard')
const read = (file: string) => readFileSync(join(DASHBOARD, file), 'utf8')
const components = (readdirSync(DASHBOARD, { recursive: true }) as string[]).filter(file => file.endsWith('.stx')).sort()
const commerceDialogs = components.filter(file => file.startsWith('Commerce/') && file.endsWith('Dialog.stx'))

/** What the Modal's own server script names: its props, as it destructures them. */
function modalNames(): string[] {
  const modal = read('UI/Modal.stx')
  const props = /const \{([^}]+)\} = defineProps<ModalProps>\(\)/.exec(modal)
  return (props?.[1] ?? '').split(',').map(entry => entry.split('=')[0]!.trim()).filter(Boolean)
}

describe('commerce dialogs', () => {
  it('write no input, dropdown or text area of their own', () => {
    expect(commerceDialogs.length).toBeGreaterThan(40)
    const native: Record<string, number> = {}
    let shared = 0
    for (const file of commerceDialogs) {
      const source = read(file)
      const found = (source.match(/<(?:input|select|textarea)\b/g) || []).length
      if (found > 0)
        native[file] = found
      shared += (source.match(/<(?:Input|Select|Textarea)\b/g) || []).length
    }
    expect(native).toEqual({})
    // Every one of them moved, none was dropped: 166 controls were counted before.
    expect(shared).toBe(166)
  })

  it('bind nothing into a control under a name the Modal has for itself', () => {
    // A prop bound in a Modal's slot is first read in the Modal's own server
    // script. A field named `description` opened showing the dialog's own
    // description text, and `title` would have shown its title.
    const taken = modalNames()
    expect(taken).toEqual(expect.arrayContaining(['title', 'description', 'size', 'position', 'role']))
    const collisions: string[] = []
    for (const file of components) {
      const source = read(file)
      if (!source.includes('<Modal'))
        continue
      for (const [, name] of source.matchAll(/v-model:(?:value|checked)="([\w$]+)"/g)) {
        if (taken.includes(name!))
          collisions.push(`${file}: ${name}`)
      }
    }
    expect(collisions).toEqual([])
  })

  it('keep what a field is held to, and say what it said', () => {
    const category = read('Commerce/CommerceCategoryDialog.stx')
    expect(category).toContain('<Input v-model:value="name" label="Name" :maxLength="50" :required="true" />')
    expect(category).toContain('<Input v-model:value="slug" label="Slug" :required="true" :spellcheck="false" :monospace="true" @input="markSlugTouched" @blur="normalizeSlug" />')
    expect(category).toContain('<Input v-model:value="displayOrder" label="Display order" type="number" min="0" step="1" :required="true" />')
    // A choice that may be left empty is one of the options; nothing is forced.
    expect(category).toContain(`<Select v-model:value="parentCategoryId" label="Parent category" placeholder="" :options="[{ value: '', label: 'Root category' }, ...parentOptions().map(option => ({ value: option.id, label: option.name }))]" />`)
    // A choice that must be made keeps its prompt, which cannot be chosen.
    expect(read('Commerce/ProductWaitlistEntryDialog.stx')).toContain('ariaLabel="Product" :required="true" placeholder="Select a product"')
    // A name and a message that follow what is typed.
    const product = read('Commerce/CommerceProductDialog.stx')
    expect(product).toContain(`:label="'Price (' + currency() + ')'"`)
    expect(product).toContain(`:error="price() !== '' ? priceError() : ''"`)
    expect(product).toContain(`:error="nutritionValid() ? '' : 'Enter a valid JSON object.'"`)
    // A list of suggestions stays beside the input it belongs to.
    expect(read('Commerce/CommerceTaxDialog.stx')).toMatch(/<Input v-model:value="type" label="Type" list="tax-rate-types" :maxLength="100" :required="true" \/>\s*<datalist id="tax-rate-types">/)
  })

  it('read a number from an input as the text it reports', () => {
    // The shared input reports what was typed. The tax rate was bound with
    // `.number` and sent as it stood; it is made a number where it is used.
    const tax = read('Commerce/CommerceTaxDialog.stx')
    expect(tax).toContain(`const rateValue = derived(() => rate() === '' ? Number.NaN : Number(rate()))`)
    expect(tax).toContain('rate: rateValue(),')
    expect(tax).not.toContain('rate: rate(),')
    // A handler is handed the value, not the event.
    expect(read('Commerce/CommerceGiftCardDialog.stx')).toContain('function syncCurrentBalance(next: string): void {')
    for (const file of ['Commerce/ProductWaitlistEntryDialog.stx', 'Commerce/RestaurantWaitlistEntryDialog.stx'])
      expect(read(file)).toContain('function hydrateCustomer(selectedId: string): void {')
    for (const file of commerceDialogs)
      expect(read(file), file).not.toMatch(/\(event\.target as HTML(?:Input|Select|TextArea)Element\)/)
  })
})

describe('the shared controls', () => {
  it('the input passes on what the browser holds a value to', () => {
    const input = read('UI/Input.stx')
    for (const binding of [
      ':min="bound(liveMin())"',
      ':max="bound(liveMax())"',
      ':step="bound(liveStep())"',
      ':maxlength="liveMaxLength() || null"',
      ':minlength="liveMinLength() || null"',
      ':inputmode="liveInputmode() || null"',
      ':spellcheck="liveSpellcheck() === null ? null : String(liveSpellcheck())"',
      ':list="liveList() || null"',
    ])
      expect(input).toContain(binding)
    // Zero is a real minimum: only an empty value leaves the attribute off.
    expect(input).toContain(`return value === '' || value === null || value === undefined ? null : value`)
    expect(input).toContain(`liveType() === 'number' ? 'tabular-nums' : ''`)
    expect(input).toContain(`liveMonospace() ? 'font-mono' : ''`)
    expect(read('UI/Textarea.stx')).toContain(':spellcheck="liveSpellcheck() === null ? null : String(liveSpellcheck())"')
  })

  it('the dropdown keeps its choice when the options come after the value', () => {
    // A picker's options arrive from a search. Without this the dropdown
    // showed its first option while the form held another.
    expect(read('UI/Select.stx')).toContain(':selected="String(optionValue(option)) === String(liveValue())"')
  })
})
