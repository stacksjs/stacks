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
