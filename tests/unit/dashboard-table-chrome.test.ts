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
    // Activity too: its model declares no write routes, so its rows get the eye alone.
    expect(records).toContain(`MODEL_SLUGS: Record<DataMode, string> = { activity: 'activity', users: 'user', teams: 'team', subscribers: 'subscriber' }`)
    // The pencil and trash also leave an anonymized account's row (stacksjs/stacks#3254).
    expect(records).toContain(`...(capabilities().update ? [{ action: 'edit', label: 'Edit', when: NOT_ANONYMIZED }] : [])`)
    expect(records).toContain(`...(capabilities().destroy ? [{ action: 'delete', label: 'Delete', when: NOT_ANONYMIZED }] : [])`)
    expect(records.match(/:row-actions="rowActions\(\)"/g)?.length).toBe(2)
  })

  test('the eye and the pencil each open a page of the record\'s own, not a dialog', () => {
    const detail = read('Models/ModelRecordDetail.stx')
    const edit = read('Models/ModelRecordEdit.stx')
    const browser = read('Models/ModelRecordsDashboard.stx')
    // From a list page, with the way back to it.
    expect(records).toContain('navigate(modelRecordHref(modelSlug(), payload.row.id, `/data/${mode()}`))')
    expect(records).toContain('navigate(modelRecordEditHref(modelSlug(), payload.row.id, { from: `/data/${mode()}` }))')
    // From the model browser, to the same two pages.
    expect(browser).toContain('navigate(modelRecordHref(slug(), String(row.id)))')
    expect(browser).toContain('navigate(modelRecordEditHref(slug(), String(row.id)))')
    // From the record page, Edit comes back to it.
    expect(detail).toContain(`via: 'view'`)
    expect(readFileSync(resolve('storage/framework/defaults/views/dashboard/models/[model]/[id].stx'), 'utf8')).toContain('<ModelRecordDetail />')
    expect(readFileSync(resolve('storage/framework/defaults/views/dashboard/models/[model]/[id]/edit.stx'), 'utf8')).toContain('<ModelRecordEdit />')
    expect(detail).toContain('modelRecordSections(record()!, relationNames())')
    expect(detail).toContain('modelRecordBackHref(slug(), from)')
    // No dialog is left for either.
    for (const source of [records, browser, detail, edit]) {
      expect(source).not.toContain('EditRecordModal')
      expect(source).not.toContain('viewOnly')
    }
  })

  test('the edit page mirrors the record page and returns where the visitor came from', () => {
    const edit = read('Models/ModelRecordEdit.stx')
    expect(edit).toContain('<nav aria-label="Breadcrumb"')
    expect(edit).toContain('<span aria-current="page">Edit</span>')
    expect(edit).toContain('Edit {{ modelName() }}</h1>')
    expect(edit).toContain('const returnHref = derived(() => cameFromView ? viewHref() : listHref())')
    expect(edit).toContain('<Button type="submit" variant="primary" :loading="saving()">Save changes</Button>')
    expect(edit).toContain('@click="cancel">Cancel</Button>')
    // A model that does not allow updates says so instead of showing a form.
    expect(edit).toContain(`:title="modelName() + ' records cannot be edited here'"`)
  })

  test('the Users, Teams and Subscribers pages offer a way to add one where the model allows it', () => {
    // Teams and Subscribers get "Create", which opens the model's form. Users
    // gets "Invite user": a new user needs a password no form can collect, so
    // the account is created and its holder is mailed a link to choose one.
    expect(records).toContain('const canCreate = derived(() => Boolean(modelSlug()) && (capabilities().create || capabilities().invite))')
    expect(records).toContain('const createLabel = derived(() => canInvite() ? `Invite ${page().one}` : `Create ${page().one}`)')
    expect(records).toContain('<Button :if="canCreate()" variant="primary" @click="createRecord">')
    expect(records).toContain('{{ createLabel() }}')
    expect(records).toContain('navigate(canInvite() ? userInviteHref(`/data/${mode()}`) : modelRecordCreateHref(modelSlug(), `/data/${mode()}`))')
  })

  test('creating a record is a page too, opened from the model browser', () => {
    const create = read('Models/ModelRecordCreate.stx')
    const browser = read('Models/ModelRecordsDashboard.stx')
    expect(browser).toContain('navigate(modelRecordCreateHref(slug()))')
    expect(browser).not.toContain('CreateRecordModal')
    expect(readFileSync(resolve('storage/framework/defaults/views/dashboard/models/[model]/create.stx'), 'utf8')).toContain('<ModelRecordCreate />')
    expect(create).toContain('<nav aria-label="Breadcrumb"')
    expect(create).toContain('<span aria-current="page">Create</span>')
    expect(create).toContain('Create {{ modelName() }}</h1>')
    // A created record opens on its own page; a refusal stays, with the messages.
    expect(create).toContain('modelRecordHref(slug(), result.id')
    expect(create).toContain('createError.set(result.error)')
    expect(create).toContain(`:title="modelName() + ' records cannot be created here'"`)
  })

  test('the record page is a breadcrumb, a title and titled field cards two across', () => {
    const detail = read('Models/ModelRecordDetail.stx')
    // "Users > View", then "View User", with Edit as the primary action.
    expect(detail).toContain('<nav aria-label="Breadcrumb"')
    expect(detail).toContain('<StxLink :to="backHref()"')
    expect(detail).toContain('<span aria-current="page">View</span>')
    expect(detail).toContain('View {{ modelName() }}</h1>')
    expect(detail).toContain('<Button :if="canEdit()" variant="primary"')
    // One card per group of fields, each field a label over its value.
    expect(detail).toContain('class="grid gap-6 grid-cols-1 items-start lg:grid-cols-2"')
    expect(detail).toContain('<div :for="section in sections()"')
    expect(detail).toContain('{{ section.title }}</h2>')
    expect(detail).toContain('<div :for="detail in section.details"')
    for (const kind of ['boolean', 'badge', 'json', 'text'])
      expect(detail).toContain(`detail.kind === '${kind}'`)
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

describe('dashboard consistency', () => {
  test('every page title is the same weight and size', () => {
    // 32 pages said font-bold text-2xl and 25 said something else: semibold,
    // text-xl, or a text-base heading that read as a section label. The
    // record pages (view, edit, create, invite) are larger on purpose.
    const larger = new Set(['Data/UserInvite.stx', 'Models/ModelRecordCreate.stx', 'Models/ModelRecordDetail.stx', 'Models/ModelRecordEdit.stx'])
    const notPages = ['Auth/', 'Feedback/', 'Transaction/', 'Teams/TeamInvitationDashboard.stx', 'NotFoundDashboard.stx']
    const root = resolve('storage/framework/defaults/resources/components/Dashboard')
    const odd: string[] = []
    for (const file of templates(root)) {
      const name = file.slice(root.length + 1)
      // Access Tokens lives beside the sign-in components but is a dashboard page.
      if (larger.has(name) || (name !== 'Auth/AccessTokens.stx' && notPages.some(prefix => name.startsWith(prefix))))
        continue
      for (const [, classes] of readFileSync(file, 'utf8').matchAll(/<h1 class="([^"]*)"/g)) {
        const tokens = classes!.split(/\s+/)
        if (!tokens.includes('font-bold') || !tokens.includes('text-2xl'))
          odd.push(`${name}: ${classes}`)
      }
    }
    expect(odd).toEqual([])
  })

  test('the jobs table opens a job with the eye, like every other table', () => {
    const jobs = read('Jobs/JobTable.stx')
    expect(jobs).toContain(`:aria-label="'View job ' + job.name" :title="'View job ' + job.name"`)
    expect(jobs).toContain('i-hugeicons-view')
    expect(jobs).not.toMatch(/>\s*View\s*<\/StxLink>/)
  })

  test('a badge keeps the space between its number and its word', () => {
    // "{{ n }} editable" inside a Badge rendered "1editable".
    expect(read('Settings/SettingsDashboard.stx')).toContain(`{{ editableCount() + ' editable' }}`)
  })
})
