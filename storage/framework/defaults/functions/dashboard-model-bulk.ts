/**
 * Acting on the rows selected in a model's list: one of the model's own
 * actions (`on: ['bulk']`), or a delete.
 *
 * A selection is acted on one record at a time, each through the endpoint a
 * single row uses, so every guard a single press has applies to each record
 * and nothing about an action changes for it. It is not all or nothing and
 * does not claim to be (a write through a model takes no part in a
 * transaction, stacksjs/stacks#3269): what is reported is what happened, how
 * many were done and, for the rest, which and why.
 */
import { DashboardApiError } from './dashboard-api'
import type { ModelActionResult, ModelCustomAction, ModelDeleteOutcome } from './dashboard-model-record'
import { deleteModelRecord, runModelAction } from './dashboard-model-record'

export interface ModelBulkFailure {
  id: string
  /** Why, in the words the refusal came back with. */
  error: string
}

export interface ModelBulkResult {
  /** How many records were to be acted on. */
  total: number
  done: number
  /** Of the ones done by a delete: kept, with their personal details removed. */
  anonymized: number
  /** The records that were refused, in the order they were tried. */
  failed: ModelBulkFailure[]
  /** Why the run stopped early, when it did. The records after it were not attempted. */
  stopped: string
  /** The record the run stopped at. It was tried, and not done. */
  stoppedAt: string
  /**
   * The input itself was refused, by the first record tried: the messages
   * for its fields. Nothing ran, and the form that asked can show them.
   * Empty otherwise.
   */
  invalid: Record<string, string[]>
}

type Attempt = { ok: true, anonymized?: boolean } | { ok: false, error: string, status: number, errors?: Record<string, string[]> }

/** The model's actions offered for a selection. */
export function modelBulkActions(actions: ModelCustomAction[] | undefined): ModelCustomAction[] {
  return (actions ?? []).filter(action => action.places.includes('bulk'))
}

/**
 * The selected rows an action is for. Which records an action applies to is
 * the server's to say (its `when`, an erased account); a selected row it
 * does not list for the action is left alone.
 */
export function modelBulkTargets(action: ModelCustomAction, rowActions: Record<string, string[]> | undefined, selected: string[]): string[] {
  return selected.filter(id => (rowActions?.[id] ?? []).includes(action.name))
}

/** The selected rows a delete is for: every one that is not already anonymized. */
export function modelBulkDeleteTargets(selected: string[], anonymizedIds: string[]): string[] {
  return selected.filter(id => !anonymizedIds.includes(id))
}

/**
 * A refusal that is about the record (a rule it breaks, a state it is in)
 * says nothing about the next one. One that is not (the server failing, the
 * network gone) will be the same for all of them.
 */
function stopsTheRun(status: number): boolean {
  return status === 0 || status >= 500
}

/**
 * Try each record in turn. A refused record is noted and the run goes on; a
 * failure that is not about the record stops it, so a broken backend is not
 * pressed a hundred times.
 */
export async function modelBulkRun(ids: string[], attempt: (id: string) => Promise<Attempt>, progress: (done: number, total: number) => void = () => {}): Promise<ModelBulkResult> {
  const result: ModelBulkResult = { total: ids.length, done: 0, anonymized: 0, failed: [], stopped: '', stoppedAt: '', invalid: {} }
  for (const [index, id] of ids.entries()) {
    progress(index, ids.length)
    const outcome = await attempt(id)
    if (outcome.ok) {
      result.done += 1
      if (outcome.anonymized)
        result.anonymized += 1
      continue
    }
    // What was typed is the same for every record. If the first one says a
    // field is wrong, so will the rest: back to the form, with nothing done.
    if (index === 0 && outcome.errors && Object.keys(outcome.errors).length > 0) {
      result.invalid = outcome.errors
      break
    }
    if (stopsTheRun(outcome.status)) {
      result.stopped = outcome.error
      result.stoppedAt = id
      break
    }
    result.failed.push({ id, error: outcome.error })
  }
  progress(ids.length, ids.length)
  return result
}

/**
 * Run one of the model's own actions on each of these records. `input` is
 * what its form was told, asked once and given to every record.
 */
export function runModelActionOnEach(
  slug: string,
  ids: string[],
  name: string,
  options: {
    input?: Record<string, unknown>
    progress?: (done: number, total: number) => void
    run?: (slug: string, id: string, name: string, input: Record<string, unknown>) => Promise<ModelActionResult>
  } = {},
): Promise<ModelBulkResult> {
  const run = options.run ?? runModelAction
  return modelBulkRun(ids, async (id) => {
    const outcome = await run(slug, id, name, options.input ?? {})
    return outcome.ok ? { ok: true } : { ok: false, error: outcome.error, status: outcome.status ?? 0, errors: outcome.errors }
  }, options.progress)
}

/** Delete each of these records, as the trash on its row would. */
export function deleteModelRecords(
  slug: string,
  ids: string[],
  progress?: (done: number, total: number) => void,
  remove: (slug: string, id: string) => Promise<ModelDeleteOutcome> = deleteModelRecord,
): Promise<ModelBulkResult> {
  return modelBulkRun(ids, async (id) => {
    try {
      return { ok: true, anonymized: (await remove(slug, id)) === 'anonymized' }
    }
    catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason), status: reason instanceof DashboardApiError ? reason.status : 0 }
    }
  }, progress)
}

function records(count: number): string {
  return count === 1 ? 'record' : 'records'
}

/**
 * How far an action on a selection reaches: how many of the selected records
 * it will run on, and that each is done on its own.
 */
export function modelBulkActionScope(targets: number, selected: number): string {
  const scope = targets === selected
    ? `It will run on the ${selected === 1 ? 'selected record' : `${selected} selected records`}.`
    : `It will run on ${targets} of the ${selected} selected records. The other ${selected - targets === 1 ? 'one is not one' : `${selected - targets} are not ones`} it applies to.`
  return [scope, targets > 1 ? 'Each record is done on its own: one that is refused does not stop the others.' : ''].filter(Boolean).join(' ')
}

/** What the confirmation says before one of the model's actions runs on a selection. */
export function modelBulkActionConfirm(action: ModelCustomAction, targets: number, selected: number): { title: string, description: string } {
  return {
    title: `${action.label}?`,
    // The model's own sentence about what happens, then how far it reaches.
    description: [action.confirm, modelBulkActionScope(targets, selected)].filter(Boolean).join(' '),
  }
}

/** What the confirmation says before a selection is deleted. */
export function modelBulkDeleteConfirm(targets: number, selected: number, anonymizes: boolean): { title: string, description: string } {
  const skipped = selected - targets
  return {
    title: `Delete ${targets === 1 ? 'this record' : `these ${targets} records`}?`,
    description: [
      `${targets === 1 ? 'It' : 'They'} will be deleted. This cannot be undone from the dashboard.`,
      anonymizes ? 'An account other records still refer to is anonymized instead: its name and email are removed, sign-in is revoked and those records are kept.' : '',
      skipped > 0 ? `${skipped === 1 ? 'One of the selected is' : `${skipped} of the selected are`} already anonymized and left alone.` : '',
      targets > 1 ? 'Each record is deleted on its own: one that is refused does not stop the others.' : '',
    ].filter(Boolean).join(' '),
  }
}

/** The most refusals a toast spells out before it counts the rest. */
const SPELLED_OUT = 3

function refusals(result: ModelBulkResult, modelName: string): string {
  const said = result.failed.slice(0, SPELLED_OUT).map(failure => `${modelName} ${failure.id}: ${failure.error.replace(/[.\s]+$/, '')}.`)
  const more = result.failed.length - said.length
  if (more > 0)
    said.push(`And ${more} more.`)
  if (result.stopped) {
    // The record it stopped at was tried; the ones after it were not.
    const untried = result.total - result.done - result.failed.length - 1
    said.push(`Stopped at ${modelName} ${result.stoppedAt}: ${result.stopped.replace(/[.\s]+$/, '')}.`)
    if (untried > 0)
      said.push(`The ${untried === 1 ? 'one' : untried} after it ${untried === 1 ? 'was' : 'were'} not attempted.`)
  }
  return said.join(' ')
}

/**
 * The toast after a selection was acted on: what happened, in numbers, and
 * for the records that were not done, which and why.
 */
export function modelBulkNotice(
  what: { kind: 'action', label: string } | { kind: 'delete' },
  modelName: string,
  result: ModelBulkResult,
): { tone: 'success' | 'warning' | 'error', title: string, detail: string } {
  const clean = result.failed.length === 0 && !result.stopped
  if (what.kind === 'delete') {
    const gone = result.done - result.anonymized
    const counted = [gone > 0 ? `${gone} deleted` : '', result.anonymized > 0 ? `${result.anonymized} anonymized` : ''].filter(Boolean).join(', ')
    const kept = result.anonymized > 0 ? 'Other records still refer to the anonymized accounts, so they were kept with their name and email removed.' : ''
    if (clean)
      return { tone: 'success', title: counted || 'Nothing to delete', detail: kept }
    return { tone: result.done > 0 ? 'warning' : 'error', title: result.done > 0 ? `${counted}, ${result.total - result.done} not` : 'Could not delete', detail: [refusals(result, modelName), kept].filter(Boolean).join(' ') }
  }
  if (clean)
    return { tone: 'success', title: what.label, detail: `Done for ${result.done} ${records(result.done)}.` }
  return {
    tone: result.done > 0 ? 'warning' : 'error',
    title: result.done > 0 ? `${what.label}: ${result.done} of ${result.total} done` : `${what.label} did not run`,
    detail: refusals(result, modelName),
  }
}
