import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * The chrome around a dashboard table, as the Users and Teams pages showed it:
 * a header in its column's code font, a table framed inside a card that was
 * already framed, a pager for five rows, and stats that left a hole.
 */

const read = (file: string) => readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard', file), 'utf8')
const table = read('UI/Table.stx')
const records = read('Data/DataRecords.stx')

/** The body of a function in a component's script, up to its closing brace. */
function body(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`)
  expect(start).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('\n}\n', start))
}

describe('dashboard table chrome', () => {
  test('a column\'s cell classes stay off its header', () => {
    expect(body(table, 'headerClass')).not.toContain('column.class')
    expect(body(table, 'cellClass')).toContain('column.class')
  })

  test('a table can leave the frame to the card it sits in', () => {
    expect(table).toContain(`const framed = useReactiveProp('framed', true)`)
    expect(table).toMatch(/:class="framed\(\) \? 'border border-stone-200\/80 rounded-xl/)
    for (const file of ['Data/DataRecords.stx', 'Content/SeoDashboard.stx', 'Auth/AccessTokens.stx', 'App/SourceInventory.stx', 'App/RequestsOverview.stx'])
      expect(read(file), file).toContain(':framed="false"')
  })

  test('the pager shows only when the rows do not fit on the smallest page', () => {
    expect(body(table, 'needsPager')).toContain('Math.min(...pageSizeOptions(), pageSize())')
    expect(table).toContain(':if="paginated() && needsPager()"')
  })

  test('the records page counts in plain words and fills its stats row', () => {
    expect(records).not.toContain('loaded records')
    expect(records).toContain('{{ countLabel() }}')
    expect(records).toContain(`page().cards === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'`)
    expect(records).toContain(`recorded('updatedAt', 'Updated', 'Not since registering')`)
  })
})

/** Every dashboard template, components and pages. */
function templates(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry)
    return statSync(file).isDirectory() ? templates(file) : file.endsWith('.stx') ? [file] : []
  })
}

describe('dashboard spacing', () => {
  test('an unframed table lines its outer columns up with the card around it', () => {
    const edge = body(table, 'edgePadding')
    expect(edge).toContain(`framed() ? 'pl-6' : 'pl-5'`)
    expect(edge).toContain(`last && !framed() ? 'pr-5' : 'pr-4'`)
    expect(body(table, 'headerClass')).toContain('edgePadding(index)')
    expect(body(table, 'cellClass')).toContain('edgePadding(index)')
  })

  test('no space-y stack spaces a component, whose wrapper takes no margin', () => {
    // stx renders a component inside a display: contents wrapper, so the
    // margin space-y puts on it lands on nothing: the Users card sat flush
    // under its stats. A flex column's gap reaches through the wrapper.
    const tag = /<(\/?)([A-Za-z][\w.-]*)\b([^>]*?)(\/?)>/g
    const offenders: string[] = []
    for (const root of ['storage/framework/defaults/resources/components/Dashboard', 'storage/framework/defaults/views/dashboard']) {
      for (const file of templates(resolve(root))) {
        const source = readFileSync(file, 'utf8')
          .replace(/<script\b[\s\S]*?<\/script>/g, '')
          .replace(/<style\b[\s\S]*?<\/style>/g, '')
          .replace(/\{\{--[\s\S]*?--\}\}/g, '')
        const stack: Array<{ name: string, spaced: boolean, children: number }> = []
        for (const [, close, name, attrs, selfClosing] of source.matchAll(tag)) {
          if (close) {
            while (stack.length && stack.at(-1)!.name !== name) stack.pop()
            stack.pop()
            continue
          }
          const parent = stack.at(-1)
          if (parent) {
            parent.children++
            if (parent.spaced && parent.children > 1 && /^[A-Z]/.test(name!) && name !== 'StxLink')
              offenders.push(`${file.split('defaults/')[1]}: <${name}>`)
          }
          const cls = /(?<![:\w-])class="([^"]*)"/.exec(attrs ?? '')?.[1] ?? ''
          if (!selfClosing && !/^(?:input|img|br|hr|meta|link|source)$/i.test(name!))
            stack.push({ name: name!, spaced: /(?:^|\s)space-y-[\d.]+(?:\s|$)/.test(cls), children: 0 })
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('dashboard row actions', () => {
  test('view, edit and delete look the same in every table: eye, pencil, red trash', () => {
    expect(table).toContain(`view: { icon: 'i-hugeicons-view'`)
    expect(table).toContain(`edit: { icon: 'i-hugeicons-pencil-edit-02', class: 'text-blue-500' }`)
    expect(table).toContain(`delete: { icon: 'i-hugeicons-delete-02', class: 'text-red-500' }`)
    // The standard icon wins, so no table can drift back to its own.
    expect(body(table, 'rowActionIconClass')).toContain('standard?.icon ?? action.icon')
  })

  test('no table sets its own icon or colour for a standard action', () => {
    const drifted: string[] = []
    for (const file of templates(resolve('storage/framework/defaults/resources/components/Dashboard'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\{ action: '(?:view|edit|delete)'[^\n]*\b(?:icon|class): /g))
        drifted.push(`${file.split('Dashboard/')[1]}: ${match[0].slice(0, 60)}`)
    }
    expect(drifted).toEqual([])
  })

  test('the Users, Teams and Subscribers tables offer actions their model allows', () => {
    expect(records).toContain(`MODEL_SLUGS: Partial<Record<DataMode, string>> = { users: 'user', teams: 'team', subscribers: 'subscriber' }`)
    expect(records).toContain(`...(capabilities().update ? [{ action: 'edit', label: 'Edit' }] : [])`)
    expect(records).toContain(`...(capabilities().destroy ? [{ action: 'delete', label: 'Delete' }] : [])`)
    expect(records.match(/:row-actions="rowActions\(\)"/g)?.length).toBe(2)
  })

  test('an icon-only button names itself on hover', () => {
    const button = read('UI/Button.stx')
    expect(body(button, 'hoverTitle')).toContain(`liveTitle() || (liveIconOnly() ? liveAriaLabel() : '') || undefined`)
    expect(button.match(/:title="hoverTitle\(\)"/g)?.length).toBe(3)
  })
})

describe('dashboard loops', () => {
  test('no dashboard template loops on <template :for>', () => {
    // stx strips <template> wrappers, so a component inside a <template :for>
    // loses every prop and slot binding that reads the loop variable and
    // renders empty (stacksjs/stx#2179, which now warns on exactly this). The
    // loop goes on the element it repeats, which is stx's documented spelling,
    // so the dashboard uses it everywhere and a later edit cannot put a
    // component back inside a template loop by adding one to an existing loop.
    const offenders: string[] = []
    for (const root of ['storage/framework/defaults/resources/components/Dashboard', 'storage/framework/defaults/views/dashboard']) {
      for (const file of templates(resolve(root))) {
        const source = readFileSync(file, 'utf8')
          .replace(/<script\b[\s\S]*?<\/script>/g, '')
          .replace(/\{\{--[\s\S]*?--\}\}/g, '')
          .replace(/<!--[\s\S]*?-->/g, '')
        if (/<template\b[^>]*\s:for=/.test(source))
          offenders.push(file.split('defaults/')[1]!)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('table loops', () => {
  test('rows and row actions loop on real elements, never <template :for>', () => {
    // stx strips <template> wrappers during server processing, so a component
    // inside a <template :for> lost the bindings that read the loop variable:
    // every row action rendered as an unlabelled square with no icon
    // (stacksjs/stx#2179). Its documented spelling puts :for on the element.
    expect(table).toContain('<tr :for="(row, rowIndex) in visibleRows()"')
    expect(table).toContain('<span :for="action in rowActions()" class="contents">')
    expect(table).not.toContain('<template :for="(row, rowIndex) in visibleRows()">')
    expect(table).not.toContain('<template :for="action in rowActions()">')
  })
})
