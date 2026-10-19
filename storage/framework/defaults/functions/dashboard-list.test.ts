import { describe, expect, it } from 'bun:test'
import { pageControls, useRecordsDashboard } from './dashboard-list'

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
