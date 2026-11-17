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

/**
 * The dialogs outside commerce, area by area as each is converted
 * (stacksjs/stacks#3310): how many shared controls each area's dialogs hold
 * now, which is how many native ones they had, so none was dropped.
 */
const CONVERTED_AREAS: Record<string, { shared: number, checkboxes: number }> = {
  // 29 native before: 26 fields, a post's categories and tags (one checkbox
  // per option now), and the upload dialog's file picker, kept below.
  'Content/': { shared: 26, checkboxes: 2 },
  'Marketing/': { shared: 35, checkboxes: 0 },
  // 31 before: the restore's downtime acknowledgement is the shared Checkbox.
  'Operations/': { shared: 30, checkboxes: 1 },
  'Kanban/': { shared: 7, checkboxes: 0 },
  // A token's scopes, several of many: one checkbox per scope.
  'Auth/': { shared: 3, checkboxes: 1 },
  'Library/': { shared: 1, checkboxes: 0 },
}

/** A native control a converted dialog keeps, and why the shared ones cannot do its job. */
const NATIVE_KEPT: Record<string, { count: number, because: string }> = {
  'Content/FileUploadDialog.stx': { count: 1, because: 'a file picker drawn as a drop zone, and the shared controls have no file input' },
}

describe('dialogs outside commerce', () => {
  for (const [area, expected] of Object.entries(CONVERTED_AREAS)) {
    it(`${area} write no input, dropdown or text area of their own`, () => {
      const dialogs = components.filter(file => file.startsWith(area) && file.endsWith('Dialog.stx'))
      expect(dialogs.length).toBeGreaterThan(0)
      const native: Record<string, number> = {}
      let shared = 0
      let checkboxes = 0
      for (const file of dialogs) {
        const source = read(file)
        const found = (source.match(/<(?:input|select|textarea)\b/g) || []).length
        if (found > 0)
          native[file] = found
        shared += (source.match(/<(?:Input|Select|Textarea)\b/g) || []).length
        checkboxes += (source.match(/<Checkbox\b/g) || []).length
      }
      const kept = Object.fromEntries(Object.entries(NATIVE_KEPT).filter(([file]) => file.startsWith(area)).map(([file, entry]) => [file, entry.count]))
      expect(native).toEqual(kept)
      expect({ shared, checkboxes }).toEqual(expected)
    })
  }

  it('leave no dialog anywhere in the dashboard writing a control of its own', () => {
    // Every area is converted, so a dialog added in a new folder is held to it too.
    const dialogs = components.filter(file => file.endsWith('Dialog.stx'))
    expect(dialogs.length).toBeGreaterThan(60)
    const native: Record<string, number> = {}
    for (const file of dialogs) {
      const found = (read(file).match(/<(?:input|select|textarea)\b/g) || []).length
      if (found > 0)
        native[file] = found
    }
    expect(native).toEqual(Object.fromEntries(Object.entries(NATIVE_KEPT).map(([file, entry]) => [file, entry.count])))
  })

  it('say why each native control they keep stays', () => {
    for (const [file, entry] of Object.entries(NATIVE_KEPT)) {
      expect(entry.because.length, file).toBeGreaterThan(20)
      expect(read(file), file).toContain('type="file"')
    }
  })

  it('carry over what a field was held to', () => {
    // Lengths, kinds and focus the native fields had.
    expect(read('Content/PostEditorDialog.stx')).toContain('<Textarea v-model:value="content" name="content" label="Content" :required="true" :minLength="10" :maxLength="100000" :showCount="true"')
    expect(read('Content/BlogPostEditorDialog.stx')).toContain('<Input v-model:value="postTitle" name="title" label="Title" :required="true" :autofocus="true" />')
    expect(read('Content/AuthorEditorDialog.stx')).toContain('<Input v-model:value="email" name="email" label="Email" type="email" :required="true" autocomplete="email" />')
    expect(read('Content/TaxonomyEditorDialog.stx')).toContain('@input="markSlugTouched" @blur="normalizeSlug"')
    // Keys the native fields' modifiers handled are handled from the event.
    const card = read('Kanban/KanbanCardDialog.stx')
    expect(card).toContain('@keydown="blurOnEnter"')
    expect(card).toContain('@keydown="sendCommentOnCommandEnter"')
    expect(card).toContain('@keydown="editCommentKey(comment.id, $event)"')
    expect(card).toContain('@keydown="createLabelOnEnter"')
    expect(card).toMatch(/if \(event\.key === 'Escape'\) \{\s*event\.preventDefault\(\)\s*event\.stopPropagation\(\)/)
    expect(read('Library/SourceScaffoldDialog.stx')).toContain(':pattern="pattern()"')
  })
})

/**
 * The list pages' filter rows: a search box and a row of dropdowns, written
 * once per page with their classes copied (stacksjs/stacks#3310). They are
 * the shared SearchFilter and Select now. What is left native is named here
 * with what it is; none of it is a list page's filter row.
 */
const NATIVE_FILTER_CONTROLS_KEPT: Record<string, { selects: number, searches: number, because: string }> = {
  'GlobalSearch.stx': { selects: 0, searches: 1, because: 'the search palette: focused on open and driven by its own keys, not a filter row' },
  'Email/InboxSettingsDashboard.stx': { selects: 6, searches: 0, because: 'a settings form, not a list filter' },
  'Teams/TeamPeopleDashboard.stx': { selects: 2, searches: 0, because: 'the invite form and each member row\'s role, not a list filter' },
  'Management/AssignmentDrawer.stx': { selects: 1, searches: 0, because: 'a guard picked inside an assignment drawer, not a list filter' },
  'Remote/RemoteConsole.stx': { selects: 2, searches: 0, because: 'the host and command a console runs, not a list filter' },
  'Content/FileStoragePanel.stx': { selects: 1, searches: 0, because: 'the disk a file panel browses, not a list filter' },
  'Analytics/EventAnalytics.stx': { selects: 1, searches: 0, because: 'the currency of an event being recorded, not a list filter' },
  'Commerce/Delivery/TabNavigation.stx': { selects: 1, searches: 0, because: 'the section menu on a narrow screen, not a list filter' },
}

describe('list pages', () => {
  it('filter with the shared search box and dropdown', () => {
    const found: Record<string, { selects: number, searches: number }> = {}
    for (const file of components.filter(file => !file.startsWith('UI/'))) {
      const source = read(file)
      const selects = (source.match(/<select\b/g) || []).length
      const searches = (source.match(/<input\b[^>]*type="search"/g) || []).length
      if (selects || searches)
        found[file] = { selects, searches }
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(NATIVE_FILTER_CONTROLS_KEPT).map(([file, entry]) => [file, { selects: entry.selects, searches: entry.searches }])))
    for (const entry of Object.values(NATIVE_FILTER_CONTROLS_KEPT))
      expect(entry.because.length).toBeGreaterThan(20)
    // The walk read the dashboard, and the filter rows are there to be found.
    const shared = components.reduce((total, file) => total + (read(file).match(/<SearchFilter\b/g) || []).length, 0)
    expect(shared).toBeGreaterThan(50)
  })

  it('keep what each filter did when it changed', () => {
    // Reloads on change still read the choice just made (see the dropdown's order below).
    expect(read('Infrastructure/LogsDashboard.stx')).toContain('@search="scheduleSearch"')
    expect(read('Commerce/PrintLogsDashboard.stx')).toContain('@search="loadSearch"')
    expect(read('Models/ModelRecordsDashboard.stx')).toContain('@search="onSearchInput"')
    expect(read('Content/ContentDashboard.stx')).toContain(':options="rangeOptions" @change="changeRange"')
    // A filter passed up to the page that owns it.
    expect(read('Commerce/CommercePosCatalog.stx')).toContain(`@change="emit('category', $event)"`)
    expect(read('Email/InboxMessageList.stx')).toContain(`@search="emit('search', $event)"`)
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
    // The field a dialog focuses when it opens, and a text area's shortest text.
    expect(input).toContain(':autofocus="liveAutofocus() || null"')
    expect(read('UI/Textarea.stx')).toContain(':minlength="liveMinLength() || null"')
    expect(input).toContain(':pattern="livePattern() || null"')
    // A key is handed on as the event, so a dialog can prevent its default.
    for (const file of ['UI/Input.stx', 'UI/Textarea.stx']) {
      expect(read(file)).toContain('@keydown="handleKeydown"')
      expect(read(file)).toContain(`emit('keydown', event)`)
    }
  })

  it('the dropdown updates its value before it reports the change', () => {
    // A filter that reloads on `@change` read the old value otherwise.
    const select = read('UI/Select.stx')
    expect(select.indexOf(`emit('update:value', nextValue)`)).toBeGreaterThan(-1)
    expect(select.indexOf(`emit('update:value', nextValue)`)).toBeLessThan(select.indexOf(`emit('change', nextValue)`))
  })

  it('the search box is the shared input, and reports only what is typed', () => {
    const search = read('UI/SearchFilter.stx')
    expect(search).toContain('<Input v-model:value="term" type="search"')
    expect(search).toContain('<template #iconLeft>')
    // Not on mount, and not the value a parent seeded: a page that reloads on
    // `@search` does not reload as it opens.
    expect(search).toMatch(/const value = term\(\)\s*if \(value === known\)\s*return/)
  })

  it('the dropdown keeps its choice when the options come after the value', () => {
    // A picker's options arrive from a search. Without this the dropdown
    // showed its first option while the form held another.
    expect(read('UI/Select.stx')).toContain(':selected="String(optionValue(option)) === String(liveValue())"')
  })
})
