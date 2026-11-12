import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { DashboardApiError } from '../../storage/framework/defaults/functions/dashboard-api'
import type { ModelBulkResult } from '../../storage/framework/defaults/functions/dashboard-model-bulk'
import { deleteModelRecords, modelBulkActionConfirm, modelBulkActionScope, modelBulkActions, modelBulkDeleteConfirm, modelBulkDeleteTargets, modelBulkNotice, modelBulkTargets, runModelActionOnEach, modelBulkRun } from '../../storage/framework/defaults/functions/dashboard-model-bulk'
import type { ModelActionResult, ModelCustomAction } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * Acting on the rows selected in a model's list (stacksjs/stacks#3271).
 *
 * The list acted on one row at a time: twelve deletes were twelve trips to
 * the trash. Rows can now be ticked and deleted together, and a model's own
 * action can be offered for a selection with `on: ['bulk']`.
 *
 * A selection is acted on one record at a time, each as a single press
 * would be. It is not all or nothing (a write through a model takes no part
 * in a transaction, stacksjs/stacks#3269), so what matters is that it says
 * exactly what happened.
 */
const action = (name: string, places: ModelCustomAction['places'], extra: Partial<ModelCustomAction> = {}): ModelCustomAction => ({ name, label: 'Mark as shipped', icon: '', confirm: '', destructive: false, places, ...extra })
const result = (partial: Partial<ModelBulkResult>): ModelBulkResult => ({ total: 0, done: 0, anonymized: 0, failed: [], stopped: '', stoppedAt: '', invalid: {}, ...partial })

describe('what a selection can have done to it', () => {
  it('the actions the model offers for one, and no others', () => {
    const all = [action('ship', ['row', 'bulk']), action('audit', ['record']), action('purge', ['bulk']), action('open', ['record', 'row'])]
    expect(modelBulkActions(all).map(entry => entry.name)).toEqual(['ship', 'purge'])
    expect(modelBulkActions(undefined)).toEqual([])
  })

  it('an action runs on the selected rows the server offered it for', () => {
    const rowActions = { 7: ['ship', 'purge'], 8: ['purge'], 9: ['ship'] }
    expect(modelBulkTargets(action('ship', ['bulk']), rowActions, ['7', '8', '9', '10'])).toEqual(['7', '9'])
    // In the order they are listed, not the order they were ticked in.
    expect(modelBulkTargets(action('ship', ['bulk']), rowActions, ['9', '7'])).toEqual(['9', '7'])
    // A row the server did not list is offered nothing, not everything.
    expect(modelBulkTargets(action('ship', ['bulk']), undefined, ['7'])).toEqual([])
    expect(modelBulkTargets(action('ship', ['bulk']), {}, ['7'])).toEqual([])
  })

  it('a delete leaves an account that is already anonymized alone', () => {
    expect(modelBulkDeleteTargets(['7', '8', '9'], ['8'])).toEqual(['7', '9'])
    expect(modelBulkDeleteTargets(['7', '8'], [])).toEqual(['7', '8'])
  })
})

describe('running over a selection', () => {
  it('tries each in turn, and a refused record does not stop the next', async () => {
    const tried: string[] = []
    const progress: Array<[number, number]> = []
    const outcome = await modelBulkRun(['7', '8', '9'], async (id) => {
      tried.push(id)
      return id === '8' ? { ok: false, error: 'Already shipped.', status: 409 } : { ok: true }
    }, (done, total) => void progress.push([done, total]))
    expect(tried).toEqual(['7', '8', '9'])
    expect(outcome).toEqual(result({ total: 3, done: 2, failed: [{ id: '8', error: 'Already shipped.' }] }))
    // Told before each one, and once more when it is over.
    expect(progress).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]])
  })

  it('a failure that is not about the record stops the run', async () => {
    for (const status of [500, 503, 0]) {
      const tried: string[] = []
      const outcome = await modelBulkRun(['7', '8', '9', '10'], async (id) => {
        tried.push(id)
        return id === '8' ? { ok: false, error: 'The database is not answering.', status } : { ok: true }
      })
      // A broken backend is not pressed again for every row that is left.
      expect(tried).toEqual(['7', '8'])
      expect(outcome).toEqual(result({ total: 4, done: 1, stopped: 'The database is not answering.', stoppedAt: '8' }))
    }
  })

  it('every refusal that is about the record goes on to the next: 4xx', async () => {
    for (const status of [400, 403, 404, 409, 422, 429]) {
      const outcome = await modelBulkRun(['7', '8'], async id => id === '7' ? { ok: false, error: 'No.', status } : { ok: true })
      expect(outcome).toMatchObject({ done: 1, failed: [{ id: '7', error: 'No.' }], stopped: '' })
    }
  })

  it('an action runs once per record, by the single record\'s call', async () => {
    const calls: Array<[string, string, string, unknown]> = []
    const run = async (slug: string, id: string, name: string, input: Record<string, unknown>): Promise<ModelActionResult> => {
      calls.push([slug, id, name, input])
      return id === '8' ? { ok: false, error: 'On hold.', status: 409 } : { ok: true, message: 'Shipped.', redirect: '/models/order/1' }
    }
    expect(await runModelActionOnEach('order', ['7', '8'], 'ship', { run })).toEqual(result({ total: 2, done: 1, failed: [{ id: '8', error: 'On hold.' }] }))
    expect(calls).toEqual([['order', '7', 'ship', {}], ['order', '8', 'ship', {}]])
    // A refusal that carries no status never arrived as an answer: that stops the run.
    expect(await runModelActionOnEach('order', ['7', '8'], 'ship', { run: async () => ({ ok: false, error: 'Could not reach the server.' }) })).toMatchObject({ done: 0, stopped: 'Could not reach the server.', stoppedAt: '7' })
  })

  it('what the form was told is asked once and given to every record', async () => {
    const given: unknown[] = []
    const run = async (_slug: string, _id: string, _name: string, input: Record<string, unknown>): Promise<ModelActionResult> => {
      given.push(input)
      return { ok: true, message: '', redirect: '' }
    }
    const input = { reason: 'Recall', restock: true }
    expect(await runModelActionOnEach('order', ['7', '8'], 'refund', { input, run })).toMatchObject({ done: 2 })
    expect(given).toEqual([input, input])
  })

  it('input the first record refuses runs on none of them', async () => {
    const tried: string[] = []
    const refused = async (_slug: string, id: string): Promise<ModelActionResult> => {
      tried.push(id)
      return { ok: false, error: 'Check the field marked below.', status: 422, errors: { reason: ['Say why.'] } }
    }
    // What was typed is the same for every record: back to the form.
    expect(await runModelActionOnEach('order', ['7', '8', '9'], 'refund', { input: { reason: 'x' }, run: refused })).toEqual(result({ total: 3, invalid: { reason: ['Say why.'] } }))
    expect(tried).toEqual(['7'])

    // Refused for its fields only further in: that record's own, and the run goes on.
    const later = async (_slug: string, id: string): Promise<ModelActionResult> => id === '8'
      ? { ok: false, error: 'Check the field marked below.', status: 422, errors: { amount: ['More than was paid.'] } }
      : { ok: true, message: '', redirect: '' }
    expect(await runModelActionOnEach('order', ['7', '8', '9'], 'refund', { run: later })).toEqual(result({ total: 3, done: 2, failed: [{ id: '8', error: 'Check the field marked below.' }] }))
    // A first refusal that is not about the input is that record's own too.
    const held = async (_slug: string, id: string): Promise<ModelActionResult> => id === '7' ? { ok: false, error: 'On hold.', status: 409 } : { ok: true, message: '', redirect: '' }
    expect(await runModelActionOnEach('order', ['7', '8'], 'refund', { run: held })).toMatchObject({ done: 1, failed: [{ id: '7', error: 'On hold.' }], invalid: {} })
  })

  it('a delete counts what was removed and what was kept anonymized', async () => {
    const remove = async (_slug: string, id: string) => {
      if (id === '8')
        throw new DashboardApiError('You are signed in with this account.', 409)
      return id === '9' ? 'anonymized' as const : 'deleted' as const
    }
    expect(await deleteModelRecords('user', ['7', '8', '9'], undefined, remove)).toEqual(result({ total: 3, done: 2, anonymized: 1, failed: [{ id: '8', error: 'You are signed in with this account.' }] }))
    const broken = async () => { throw new DashboardApiError('Service unavailable.', 503) }
    expect(await deleteModelRecords('user', ['7', '8'], undefined, broken)).toMatchObject({ done: 0, stopped: 'Service unavailable.', stoppedAt: '7' })
    // Not an answer from the API at all: the network, or a response that could not be read.
    const offline = async () => { throw new TypeError('Failed to fetch') }
    expect(await deleteModelRecords('user', ['7', '8'], undefined, offline)).toMatchObject({ done: 0, stopped: 'Failed to fetch', stoppedAt: '7' })
  })
})

describe('what is said before', () => {
  it('an action: what the model says happens, then how far it reaches', () => {
    const ship = action('ship', ['bulk'], { confirm: 'The customer is emailed a tracking link.' })
    expect(modelBulkActionConfirm(ship, 5, 5)).toEqual({
      title: 'Mark as shipped?',
      description: 'The customer is emailed a tracking link. It will run on the 5 selected records. Each record is done on its own: one that is refused does not stop the others.',
    })
    expect(modelBulkActionConfirm(ship, 3, 5).description).toBe('The customer is emailed a tracking link. It will run on 3 of the 5 selected records. The other 2 are not ones it applies to. Each record is done on its own: one that is refused does not stop the others.')
    expect(modelBulkActionConfirm(ship, 2, 3).description).toContain('The other one is not one it applies to.')
    // One record: nothing to say about the others.
    expect(modelBulkActionConfirm(action('ship', ['bulk']), 1, 1).description).toBe('It will run on the selected record.')
    expect(modelBulkActionConfirm(action('ship', ['bulk']), 1, 4).description).toBe('It will run on 1 of the 4 selected records. The other 3 are not ones it applies to.')
    // The same reach, on its own, for a form that already shows the model's sentence.
    expect(modelBulkActionScope(3, 5)).toBe('It will run on 3 of the 5 selected records. The other 2 are not ones it applies to. Each record is done on its own: one that is refused does not stop the others.')
  })

  it('a delete: that it cannot be undone, and what happens to an account others refer to', () => {
    expect(modelBulkDeleteConfirm(3, 3, false)).toEqual({
      title: 'Delete these 3 records?',
      description: 'They will be deleted. This cannot be undone from the dashboard. Each record is deleted on its own: one that is refused does not stop the others.',
    })
    expect(modelBulkDeleteConfirm(1, 1, false)).toEqual({ title: 'Delete this record?', description: 'It will be deleted. This cannot be undone from the dashboard.' })
    const users = modelBulkDeleteConfirm(2, 4, true).description
    expect(users).toContain('An account other records still refer to is anonymized instead: its name and email are removed, sign-in is revoked and those records are kept.')
    expect(users).toContain('2 of the selected are already anonymized and left alone.')
    expect(modelBulkDeleteConfirm(2, 3, true).description).toContain('One of the selected is already anonymized and left alone.')
  })
})

describe('what is said after', () => {
  const ship = { kind: 'action' as const, label: 'Mark as shipped' }

  it('all done', () => {
    expect(modelBulkNotice(ship, 'Order', result({ total: 5, done: 5 }))).toEqual({ tone: 'success', title: 'Mark as shipped', detail: 'Done for 5 records.' })
    expect(modelBulkNotice(ship, 'Order', result({ total: 1, done: 1 })).detail).toBe('Done for 1 record.')
    expect(modelBulkNotice({ kind: 'delete' }, 'Order', result({ total: 5, done: 5 }))).toEqual({ tone: 'success', title: '5 deleted', detail: '' })
    expect(modelBulkNotice({ kind: 'delete' }, 'User', result({ total: 3, done: 3, anonymized: 1 }))).toEqual({ tone: 'success', title: '2 deleted, 1 anonymized', detail: 'Other records still refer to the anonymized accounts, so they were kept with their name and email removed.' })
    expect(modelBulkNotice({ kind: 'delete' }, 'User', result({ total: 2, done: 2, anonymized: 2 })).title).toBe('2 anonymized')
  })

  it('some refused: how many were done, and which were not and why', () => {
    expect(modelBulkNotice(ship, 'Order', result({ total: 3, done: 2, failed: [{ id: '8', error: 'Already shipped.' }] })))
      .toEqual({ tone: 'warning', title: 'Mark as shipped: 2 of 3 done', detail: 'Order 8: Already shipped.' })
    expect(modelBulkNotice({ kind: 'delete' }, 'User', result({ total: 3, done: 2, anonymized: 1, failed: [{ id: '12', error: 'You are signed in with this account' }] })))
      .toEqual({ tone: 'warning', title: '1 deleted, 1 anonymized, 1 not', detail: 'User 12: You are signed in with this account. Other records still refer to the anonymized accounts, so they were kept with their name and email removed.' })
  })

  it('none done is not dressed up as partly done', () => {
    expect(modelBulkNotice(ship, 'Order', result({ total: 2, failed: [{ id: '7', error: 'On hold.' }, { id: '8', error: 'On hold.' }] })))
      .toEqual({ tone: 'error', title: 'Mark as shipped did not run', detail: 'Order 7: On hold. Order 8: On hold.' })
    expect(modelBulkNotice({ kind: 'delete' }, 'Order', result({ total: 1, failed: [{ id: '7', error: 'Other records still refer to it.' }] })))
      .toEqual({ tone: 'error', title: 'Could not delete', detail: 'Order 7: Other records still refer to it.' })
  })

  it('a long list of refusals is counted past the first few', () => {
    const failed = ['1', '2', '3', '4', '5'].map(id => ({ id, error: 'On hold.' }))
    expect(modelBulkNotice(ship, 'Order', result({ total: 6, done: 1, failed })).detail).toBe('Order 1: On hold. Order 2: On hold. Order 3: On hold. And 2 more.')
  })

  it('a run that stopped says where, why, and how many it never tried', () => {
    expect(modelBulkNotice({ kind: 'delete' }, 'User', result({ total: 3, stopped: 'The database is not answering.', stoppedAt: '13' })))
      .toEqual({ tone: 'error', title: 'Could not delete', detail: 'Stopped at User 13: The database is not answering. The 2 after it were not attempted.' })
    expect(modelBulkNotice(ship, 'Order', result({ total: 4, done: 1, failed: [{ id: '2', error: 'On hold.' }], stopped: 'Service unavailable', stoppedAt: '3' })))
      .toEqual({ tone: 'warning', title: 'Mark as shipped: 1 of 4 done', detail: 'Order 2: On hold. Stopped at Order 3: Service unavailable. The one after it was not attempted.' })
    // It stopped at the last one: nothing was left untried.
    expect(modelBulkNotice(ship, 'Order', result({ total: 2, done: 1, stopped: 'Service unavailable', stoppedAt: '2' })).detail).toBe('Stopped at Order 2: Service unavailable.')
  })
})

// Driven in a browser against the running dashboard; these pin what that run
// relied on.
describe('the list', () => {
  const list = readFileSync('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordsDashboard.stx', 'utf8')

  it('draws a tick box only when there is something to do with a tick', () => {
    expect(list).toContain('const selectable = derived(() => migrated() && (bulkActions().length > 0 || writeCapabilities().destroy))')
    expect((list.match(/:if="selectable\(\)"/g) || []).length).toBe(4)
    expect(list).toContain('aria-label="Select every row on this page"')
    expect(list).toContain(':aria-label="\'Select \' + modelName() + \' \' + row.id"')
  })

  it('a selection is the rows on screen: it is dropped when they are read again', () => {
    const load = list.slice(list.indexOf('async function load()'), list.indexOf('function toggleSort'))
    expect(load.indexOf('selected.set([])')).toBeGreaterThan(-1)
    expect(load.indexOf('selected.set([])')).toBeLessThan(load.indexOf('await dashboardApi'))
  })

  it('acting on a selection always asks first, and runs through the single record\'s calls', () => {
    // In the action's form when it takes input, in a confirmation when it does not.
    expect(list).toContain('@click="startBulkAction(action)"')
    expect(list).toContain('if (modelActionAsks(action))\n    openActionForm(action, null)\n  else\n    confirmingBulk.set({ kind: \'action\', action })')
    expect(list).toContain('@click="confirmingBulk.set({ kind: \'delete\' })"')
    expect(list).toContain('result = await deleteModelRecords(slug(), bulkDeleteTargets(), track)')
    expect(list).toContain('result = await runModelActionOnEach(slug(), bulkTargets(pending.action), pending.action.name, { input, progress: track })')
    expect(list).toContain(':disabled="bulkBusy() || bulkTargets(action).length === 0"')
    // No button in the list runs a bulk action without the confirmation between.
    expect(list).not.toMatch(/@click="runBulk/)
  })
})
