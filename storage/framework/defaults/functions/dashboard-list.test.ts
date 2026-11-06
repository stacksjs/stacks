import { describe, expect, it } from 'bun:test'
import { state } from '@stacksjs/stx'
import { LARGEST_PAGE, pageControls, readEveryPage, useRecordsDashboard, useServerList } from './dashboard-list'

/** The smallest thing with the two members `pageControls` reads. */
function pageSignal(initial: number) {
  let value = initial
  const signal = (() => value) as { (): number, set: (next: number) => void }
  signal.set = (next: number) => { value = next }
  return signal
}

describe('pageControls', () => {
  it('moves a page back and forward', () => {
    const page = pageSignal(2)
    const { previousPage, nextPage } = pageControls(page, () => 5)
    previousPage()
    expect(page()).toBe(1)
    nextPage()
    nextPage()
    expect(page()).toBe(3)
  })

  it('will not go below the first page', () => {
    const page = pageSignal(1)
    const { previousPage } = pageControls(page, () => 5)
    previousPage()
    previousPage()
    expect(page()).toBe(1)
  })

  it('will not go past the last page', () => {
    const page = pageSignal(5)
    const { nextPage } = pageControls(page, () => 5)
    nextPage()
    expect(page()).toBe(5)
  })

  it('reads the last page at click time, not when it was wired up', () => {
    // A filter that shrinks the result set has to shrink the range too.
    const page = pageSignal(1)
    let last = 9
    const { nextPage } = pageControls(page, () => last)
    last = 2
    nextPage()
    nextPage()
    nextPage()
    expect(page()).toBe(2)
  })

  it('clamps an out-of-range page back into the range', () => {
    // The guard style the Marketing dashboards used could not do this: a page
    // already past the end stayed there.
    const page = pageSignal(40)
    const { nextPage, previousPage } = pageControls(page, () => 3)
    nextPage()
    expect(page()).toBe(3)
    page.set(40)
    previousPage()
    expect(page()).toBe(39)
  })

  it('survives an empty result set, where the last page is zero', () => {
    const page = pageSignal(1)
    const { nextPage } = pageControls(page, () => 0)
    nextPage()
    expect(page()).toBe(1)
  })
})

interface Row { id: number, name: string }

const byName = (rows: Row[], query: string) => rows.filter(r => r.name.toLowerCase().includes(query))

function seeded(count: number, perPage = 10) {
  const d = useRecordsDashboard<Row>({ filter: byName, perPage })
  d.records.set(Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `row ${i + 1}` })))
  return d
}

describe('useRecordsDashboard', () => {
  it('starts loading, empty, on the first page', () => {
    const d = useRecordsDashboard<Row>({ filter: byName })
    expect(d.loading()).toBe(true)
    expect(d.records()).toEqual([])
    expect(d.page()).toBe(1)
    expect(d.pageCount()).toBe(1)
    expect(d.paginatedRecords()).toEqual([])
  })

  it('pages through the records', () => {
    const d = seeded(25)
    expect(d.pageCount()).toBe(3)
    expect(d.paginatedRecords().map(r => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    d.nextPage()
    expect(d.paginatedRecords()[0]!.id).toBe(11)
    d.page.set(3)
    expect(d.paginatedRecords()).toHaveLength(5)
  })

  it('searching returns to the first page, because page 3 of a new result set is meaningless', () => {
    const d = seeded(25)
    d.page.set(3)
    d.handleSearch('row 1')
    expect(d.page()).toBe(1)
    // row 1, 10-19
    expect(d.filteredRecords()).toHaveLength(11)
  })

  it('an edit replaces in place and does not move the page', () => {
    const d = seeded(25)
    d.page.set(2)
    const target = d.records()[4]!
    d.upsert({ id: target.id, name: 'renamed' }, target)
    expect(d.records()[4]!.name).toBe('renamed')
    expect(d.records()).toHaveLength(25)
    expect(d.page()).toBe(2)
  })

  it('a create appends and lands on the page the new row is on', () => {
    const d = seeded(20)
    expect(d.pageCount()).toBe(2)
    d.upsert({ id: 99, name: 'new' }, null)
    expect(d.records()).toHaveLength(21)
    expect(d.page()).toBe(3)
    expect(d.paginatedRecords()).toEqual([{ id: 99, name: 'new' }])
  })

  it('removing the last row on the last page pulls the page back', () => {
    const d = seeded(11)
    d.page.set(2)
    expect(d.paginatedRecords()).toHaveLength(1)
    d.remove(d.records()[10]!)
    expect(d.page()).toBe(1)
    expect(d.records()).toHaveLength(10)
  })

  it('removing elsewhere leaves the page alone', () => {
    const d = seeded(25)
    d.page.set(2)
    d.remove(d.records()[0]!)
    expect(d.page()).toBe(2)
    expect(d.records()).toHaveLength(24)
  })

  it('clampPage pulls a page back into range after a filter shrinks the list', () => {
    const d = seeded(25)
    d.page.set(3)
    d.search.set('row 7')
    d.clampPage()
    expect(d.page()).toBe(1)
  })

  it('the editor opens for a create and for an edit, and remembers which', () => {
    const d = seeded(3)
    d.openCreate()
    expect(d.editorOpen()).toBe(true)
    expect(d.editorMode()).toBe('create')
    expect(d.editing()).toBeNull()

    const row = d.records()[1]!
    d.openEdit(row)
    expect(d.editorMode()).toBe('edit')
    expect(d.editing()).toBe(row)
  })

  it('will not close the editor mid-save', () => {
    // Otherwise a slow PATCH can land on a dialog the user already dismissed.
    const d = seeded(3)
    d.openEdit(d.records()[0]!)
    d.editorError.set('something went wrong')
    d.saving.set(true)
    d.closeEditor()
    expect(d.editorOpen()).toBe(true)
    expect(d.editorError()).toBe('something went wrong')

    d.saving.set(false)
    d.closeEditor()
    expect(d.editorOpen()).toBe(false)
    expect(d.editing()).toBeNull()
    expect(d.editorError()).toBe('')
  })

  it('will not close the delete confirmation mid-delete', () => {
    const d = seeded(3)
    d.requestDelete(d.records()[0]!)
    d.deleteBusy.set(true)
    d.closeDelete()
    expect(d.deleting()).not.toBeNull()

    d.deleteBusy.set(false)
    d.closeDelete()
    expect(d.deleting()).toBeNull()
  })

  it('honours a custom identity instead of id', () => {
    const d = useRecordsDashboard<{ sku: string }>({
      filter: rows => rows,
      sameRecord: (a, b) => a.sku === b.sku,
    })
    d.records.set([{ sku: 'a' }, { sku: 'b' }])
    d.remove({ sku: 'a' })
    expect(d.records()).toEqual([{ sku: 'b' }])
  })
})

describe('useRecordsDashboard goToPage', () => {
  it('jumps to a page', () => {
    const d = seeded(25)
    d.goToPage(3)
    expect(d.page()).toBe(3)
  })

  it('clamps a page that does not exist', () => {
    const d = seeded(25)
    d.goToPage(99)
    expect(d.page()).toBe(3)
    d.goToPage(0)
    expect(d.page()).toBe(1)
    d.goToPage(-4)
    expect(d.page()).toBe(1)
  })

  it('survives a non-number from a component that emitted one', () => {
    const d = seeded(25)
    d.goToPage(Number.NaN)
    expect(d.page()).toBe(1)
  })
})

describe('useServerList', () => {
  /** A fetch that records what it was asked and answers when told to. */
  function server() {
    const asked: URLSearchParams[] = []
    const pending: Array<(answer: { records: string[], total: number, page: number }) => void> = []
    const fetch = (params: URLSearchParams) => {
      asked.push(params)
      return new Promise<{ records: string[], total: number, page: number }>(resolve => pending.push(resolve))
    }
    return { asked, pending, fetch }
  }
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  it('asks for the default order and lands the answer', async () => {
    const api = server()
    const list = useServerList<string>({ fetch: api.fetch, defaultSort: { sort: 'created', direction: 'desc' } })
    const loading = list.load()
    expect(api.asked[0]!.toString()).toBe('sort=created&direction=desc&page=1&per_page=25')
    api.pending[0]!({ records: ['a', 'b'], total: 30, page: 1 })
    await loading
    expect(list.records()).toEqual(['a', 'b'])
    expect(list.total()).toBe(30)
    expect(list.loading()).toBe(false)
  })

  it('keeps only the newest answer when two overlap', async () => {
    const api = server()
    const list = useServerList<string>({ fetch: api.fetch, defaultSort: { sort: 'created', direction: 'desc' } })
    const first = list.load()
    const second = list.load()
    api.pending[1]!({ records: ['new'], total: 1, page: 1 })
    api.pending[0]!({ records: ['old'], total: 9, page: 1 })
    await Promise.all([first, second])
    expect(list.records()).toEqual(['new'])
    expect(list.total()).toBe(1)
  })

  it('asks for page 1 when a filter changes, and leaves out "all"', async () => {
    const api = server()
    const status = state('all')
    const list = useServerList<string>({ fetch: api.fetch, defaultSort: { sort: 'id', direction: 'asc' }, filters: () => ({ status: status() }) })
    list.page.set(3)
    status.set('active')
    expect(api.asked.length).toBe(1)
    expect(api.asked[0]!.get('status')).toBe('active')
    expect(api.asked[0]!.get('page')).toBe('1')
    status.set('all')
    expect(api.asked[1]!.has('status')).toBe(false)
  })

  it('sends the search once typing pauses', async () => {
    const api = server()
    const list = useServerList<string>({ fetch: api.fetch, defaultSort: { sort: 'id', direction: 'asc' }, searchDelay: 20 })
    list.search.set('a')
    list.search.set('ab')
    list.search.set('abc ')
    expect(api.asked.length).toBe(0)
    await sleep(40)
    expect(api.asked.length).toBe(1)
    expect(api.asked[0]!.get('q')).toBe('abc')
    expect(list.params().get('q')).toBe('abc')
  })

  it('maps a column header to the server sort, and an unknown one back to the default', () => {
    const api = server()
    const list = useServerList<string>({ fetch: api.fetch, defaultSort: { sort: 'created', direction: 'desc' }, columnSorts: { stopsLabel: 'stops' } })
    list.changeSort({ key: 'stopsLabel', direction: 'asc' })
    expect(api.asked[0]!.get('sort')).toBe('stops')
    expect(api.asked[0]!.get('direction')).toBe('asc')
    list.changeSort({ key: 'notes', direction: 'asc' })
    expect(api.asked[1]!.get('sort')).toBe('created')
    expect(api.asked[1]!.get('direction')).toBe('desc')
  })

  it('follows a sort select, handing the order back from a header sort', () => {
    const api = server()
    const sort = state<{ sort: string, direction: 'asc' | 'desc' }>({ sort: 'name', direction: 'asc' })
    const list = useServerList<string>({ fetch: api.fetch, defaultSort: () => sort(), columnSorts: { typeLabel: 'type' } })
    list.changeSort({ key: 'typeLabel', direction: 'desc' })
    expect(api.asked[0]!.get('sort')).toBe('type')
    list.page.set(4)
    sort.set({ sort: 'newest', direction: 'desc' })
    expect(api.asked.length).toBe(2)
    expect(api.asked[1]!.get('sort')).toBe('newest')
    expect(api.asked[1]!.get('direction')).toBe('desc')
    expect(api.asked[1]!.get('page')).toBe('1')
  })

  it('reports a failed load, and ignores one that a newer load replaced', async () => {
    const errors: unknown[] = []
    let calls = 0
    const list = useServerList<string>({
      fetch: async () => {
        calls++
        if (calls === 1)
          throw new Error('boom')
        return { records: ['ok'], total: 1, page: 1 }
      },
      defaultSort: { sort: 'id', direction: 'asc' },
      onError: error => errors.push(error),
    })
    await list.load()
    expect(list.loadError()).toBe('boom')
    expect(errors.length).toBe(1)
    await list.load()
    expect(list.loadError()).toBe('')
    expect(list.records()).toEqual(['ok'])
  })
})

describe('readEveryPage', () => {
  /** A paged endpoint over `count` numbered rows. */
  function endpoint(count: number) {
    const asked: number[] = []
    const get = async (page: number, perPage: number) => {
      asked.push(page)
      const records = Array.from({ length: count }, (_, i) => i + 1).slice((page - 1) * perPage, page * perPage)
      return { records, total: count }
    }
    return { asked, get }
  }

  it('reads every page, past the 500 a single read used to stop at', async () => {
    const api = endpoint(523)
    const rows = await readEveryPage(api.get)
    expect(rows.length).toBe(523)
    expect(rows.at(-1)).toBe(523)
    expect(api.asked).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('stops at an exact multiple of the page size, and on an empty list', async () => {
    const exact = endpoint(LARGEST_PAGE * 2)
    expect((await readEveryPage(exact.get)).length).toBe(LARGEST_PAGE * 2)
    expect(exact.asked).toEqual([1, 2])
    const empty = endpoint(0)
    expect(await readEveryPage(empty.get)).toEqual([])
    expect(empty.asked).toEqual([1])
  })

  it('refuses an answer that is not a page', async () => {
    await expect(readEveryPage(async () => ({ total: 3 }) as never)).rejects.toThrow('without records')
  })
})
