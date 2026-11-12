/**
 * What a model lets an operator do to one of its records beyond creating,
 * editing and deleting it: "Mark as shipped", "Send password reset".
 *
 * A model describes data, and these are operations, so the model does not
 * describe them. It names them: each entry of `dashboard.actions` points at an
 * action under `app/Actions`, which is where behaviour already lives, and the
 * dashboard offers it as a button on the record's page and in its row, and
 * where the model asks, for the rows selected in a list. One guarded endpoint
 * runs whichever was pressed, on one record, the way that action's own route
 * would: its `validations`, `authorize` and `before` all apply. A selection is
 * that endpoint once per record, so nothing about an action changes for it.
 *
 * `when` narrows an action to the records it makes sense for, and is checked
 * here both times: to decide which rows are sent a button, and again before
 * the action runs, so a hidden button is never the only thing in the way.
 */
import type { ResponseStatus } from '@stacksjs/bun-router'
import { response } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { type FieldAsking, MODEL_FIELD_INPUTS, readFieldAsking } from './model-fields'
import { humanizeIdentifier, type ModelCreateField, modelFieldType } from './model-write'

/**
 * Where an action is offered: on the record's own page, in its row of a
 * list, and for the rows selected in a list.
 */
export type ModelActionPlace = 'record' | 'row' | 'bulk'

/** A value a `when` compares a column to. `null` is "nothing stored". */
export type ModelActionValue = string | number | boolean | null

/** An action as the page is told about it: enough to draw the button and ask first. */
export interface ModelCustomAction {
  /** Its place in the URL that runs it. */
  name: string
  /** What the button says. */
  label: string
  /** An iconify class, or empty for the default. */
  icon: string
  /** What the confirmation says before it runs. Empty runs it at once. */
  confirm: string
  /** Drawn in red: it removes or revokes something. */
  destructive: boolean
  places: ModelActionPlace[]
  /**
   * What the action has to be told before it runs, from its own
   * `validations`: a refund's reason. Empty for one that takes nothing. With
   * any, pressing the button opens a form and not a confirmation.
   */
  fields: ModelCreateField[]
}

/** The same, with what only the server needs: which action runs, and for which records. */
export interface ModelActionDefinition extends ModelCustomAction {
  /** The handler string a route would take: `Actions/Orders/ShipOrderAction`. */
  handler: string
  when: Array<{ column: string, values: ModelActionValue[] }>
  /** How the model says the action's input is asked for, by the input's name. */
  asking: Record<string, FieldAsking>
}

/**
 * The parameters of the route that runs an action. They are part of what an
 * action can validate, and never something to ask a person: the record is
 * the one whose button was pressed.
 */
const ROUTE_PARAMETERS: ReadonlySet<string> = new Set(['id', 'dashboardModel', 'dashboardAction'])

/** Kinds of value no form input can supply: a list, a structure, a file's bytes, a secret. */
const UNASKABLE: ReadonlySet<string> = new Set(['array', 'binary', 'blob', 'file', 'object', 'password'])

/** The kinds that are text, and may be given another text input. */
const TEXT_KINDS: ReadonlySet<string> = new Set(['email', 'longtext', 'markdown', 'text', 'url'])

/**
 * The inputs an action's field can be given. Not a file chooser: an upload
 * is stored against a model's field, and an action's input is not one.
 */
const ACTION_INPUTS = MODEL_FIELD_INPUTS.filter(input => input !== 'upload')

/**
 * The form an action's input is asked for in, from the action's own
 * `validations`: one field per rule, in the control the rule calls for,
 * required where the rule is.
 *
 * `asking` is the model's say on how each is asked (`fields` on the
 * declaration). `unaskable` names what the action requires that no form can
 * give; with any, the action cannot be run from a form at all. `ignored`
 * says which of the model's settings could not be applied, and why.
 */
export function modelActionFields(validations: unknown, asking: Record<string, FieldAsking> = {}): { fields: ModelCreateField[], unaskable: string[], ignored: string[] } {
  const fields: ModelCreateField[] = []
  const unaskable: string[] = []
  // What the model asked for that cannot be done, in words that name the field.
  const ignored: string[] = []
  if (!validations || typeof validations !== 'object' || Array.isArray(validations))
    return { fields, unaskable, ignored: Object.keys(asking).map(name => `describes a field '${name}' that the action does not take`) }

  for (const [name, entry] of Object.entries(validations as Record<string, any>)) {
    const rule = entry?.rule
    if (ROUTE_PARAMETERS.has(name) || !rule || typeof rule.validate !== 'function')
      continue
    // A file rule carries no name at all.
    const kind = rule.name === null || rule.name === undefined ? 'file' : String(rule.name)
    if (UNASKABLE.has(kind)) {
      // Optional: left out of the form. Required: there is no asking for it.
      if (rule.isRequired === true)
        unaskable.push(name)
      continue
    }
    const said = asking[name]
    const derived = modelFieldType(name, { validation: { rule } })
    const type = said?.input && TEXT_KINDS.has(derived) ? said.input : derived
    // What a value is stays the rule's to say: a number is not asked for as prose.
    if (said?.input && !TEXT_KINDS.has(derived))
      ignored.push(`field '${name}' asks for the '${said.input}' input, but it is not a field of text (it is asked for as ${derived})`)
    fields.push({
      name,
      label: said?.label ?? modelActionLabel(name),
      type,
      required: rule.isRequired === true,
      defaultValue: type === 'boolean' ? false : '',
      options: Array.isArray(rule.allowedValues) ? rule.allowedValues.map(String) : [],
      ...(said?.help ? { help: said.help } : {}),
    })
  }
  for (const name of Object.keys(asking)) {
    if (!fields.some(field => field.name === name))
      ignored.push(`describes a field '${name}' that the action does not take`)
  }
  return { fields, unaskable, ignored }
}

const PLACES: readonly ModelActionPlace[] = ['record', 'row', 'bulk']

/**
 * Where an action is offered when the model does not say: one record at a
 * time. Acting on a whole selection is asked for by name, since a press then
 * runs on many records.
 */
const DEFAULT_PLACES: readonly ModelActionPlace[] = ['record', 'row']

function column(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

/**
 * A button's words from an action's name: `markShipped` is "Mark shipped",
 * `sync-api-keys` is "Sync API keys". Sentence case, as every other button in
 * the dashboard is written.
 */
export function modelActionLabel(name: string): string {
  return humanizeIdentifier(name)
    .split(' ')
    .map((word, index) => index === 0 || word === word.toUpperCase() ? word : word.toLowerCase())
    .join(' ')
}

function isValue(value: unknown): value is ModelActionValue {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}

/**
 * Read a `when`: each column with the values it may hold. Null when it cannot
 * be read, which is not the same as no condition: an action whose condition
 * is unreadable is left out, never offered for every record.
 */
function conditions(when: unknown): ModelActionDefinition['when'] | null {
  if (when === undefined || when === null)
    return []
  if (typeof when !== 'object' || Array.isArray(when))
    return null
  const parsed: ModelActionDefinition['when'] = []
  for (const [name, wanted] of Object.entries(when as Record<string, unknown>)) {
    const values = Array.isArray(wanted) ? wanted : [wanted]
    if (!/^[A-Z_]\w*$/i.test(name) || values.length === 0 || !values.every(isValue))
      return null
    parsed.push({ column: column(name), values })
  }
  return parsed
}

/**
 * The actions a model declares, and what is wrong with the ones it declares
 * badly. A declaration that cannot be read is left out and said so, in words
 * that name it: a button that could only fail is worse than no button.
 */
export function modelActionDefinitions(Model: any): { actions: ModelActionDefinition[], problems: string[] } {
  const declared = Model?.dashboard?.actions
  if (declared === undefined || declared === null)
    return { actions: [], problems: [] }
  if (!Array.isArray(declared))
    return { actions: [], problems: ['dashboard.actions is not a list'] }

  const actions: ModelActionDefinition[] = []
  const problems: string[] = []
  for (const [index, entry] of declared.entries()) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : ''
    const called = name ? `'${name}'` : `actions[${index}]`
    if (!/^[a-z][a-z\d]*(?:-[a-z\d]+)*$/i.test(name)) {
      problems.push(name ? `${called} is not a usable name: letters and digits, in camelCase or kebab-case` : `${called} has no name`)
      continue
    }
    if (actions.some(action => action.name === name)) {
      problems.push(`${called} is declared twice`)
      continue
    }
    const handler = typeof entry.action === 'string' ? entry.action.trim().replace(/\.ts$/, '') : ''
    if (!/^Actions\/[\w/-]+$/.test(handler)) {
      problems.push(`${called} does not name an action to run: \`action\` is its path under app/, as in 'Actions/Orders/ShipOrderAction'`)
      continue
    }
    const when = conditions(entry.when)
    if (!when) {
      problems.push(`${called} has a \`when\` that cannot be read: it maps a field to the value, or list of values, a record must hold`)
      continue
    }
    // How the action's input is asked for, in the words `dashboard.fields` uses.
    const asking: Record<string, FieldAsking> = {}
    if (entry.fields !== undefined) {
      if (!entry.fields || typeof entry.fields !== 'object' || Array.isArray(entry.fields)) {
        problems.push(`${called} has \`fields\` that is not an object keyed by the input's name`)
      }
      else {
        for (const [field, settings] of Object.entries(entry.fields as Record<string, unknown>)) {
          if (settings && typeof settings === 'object' && !Array.isArray(settings))
            asking[field] = readFieldAsking(`${called} field '${field}'`, settings as Record<string, unknown>, problems, ACTION_INPUTS)
          else
            problems.push(`${called} field '${field}' is not an object of settings`)
        }
      }
    }
    const on: unknown[] = entry.on === undefined ? [...DEFAULT_PLACES] : Array.isArray(entry.on) ? entry.on : [entry.on]
    const places = PLACES.filter(place => on.includes(place))
    if (places.length === 0 || places.length !== on.length) {
      problems.push(`${called} lists a place under \`on\` that is not 'record', 'row' or 'bulk'`)
      continue
    }
    actions.push({
      name,
      label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : modelActionLabel(name),
      icon: typeof entry.icon === 'string' && /^i-[\w-]+$/.test(entry.icon.trim()) ? entry.icon.trim() : '',
      confirm: typeof entry.confirm === 'string' ? entry.confirm.trim() : '',
      destructive: entry.destructive === true,
      places,
      fields: [],
      handler,
      when,
      asking,
    })
  }
  return { actions, problems }
}

function holds(stored: unknown, wanted: ModelActionValue): boolean {
  if (wanted === null)
    return stored === null || stored === undefined || stored === ''
  if (typeof wanted === 'boolean')
    return (stored === true || stored === 1 || stored === '1' || stored === 'true') === wanted
  return stored !== null && stored !== undefined && String(stored) === String(wanted)
}

/** Whether a record is one the action is for: every `when` column holds one of its values. */
export function modelActionApplies(action: ModelActionDefinition, row: unknown): boolean {
  return action.when.every(condition => condition.values.some(wanted => holds(safeGet(row, condition.column, null), wanted)))
}

/** What the page is told: the button, without the file it runs or the rule that narrows it. */
export function publicModelAction(action: ModelActionDefinition): ModelCustomAction {
  const { handler: _handler, when: _when, asking: _asking, ...shown } = action
  return shown
}

type ResolveHandler = (handler: string) => Promise<unknown>

/** What an action's input is called when the model does not say. */
function describeUnaskable(names: string[]): string {
  return names.map(name => `'${name}'`).join(', ')
}

/** What loading an action came to: what it takes, or why it could not be loaded. */
type Loaded = { validations: unknown } | { failure: string }

const loadable = new Map<string, Promise<Loaded>>()
const warned = new Set<string>()

/** Load the action as the router would, and say what it validates. */
async function resolveWithRouter(handler: string): Promise<{ validations?: unknown }> {
  const { resolveActionValidations } = await import('@stacksjs/router')
  return { validations: await resolveActionValidations(handler) }
}

/**
 * The actions a model offers: the ones it declares that can be read and whose
 * action can be loaded. The rest are said once, by name, with what to change.
 *
 * Each comes back with the form its input is asked for in, read from the
 * action's own `validations`.
 *
 * Loading is checked when the list is drawn, not when the button is pressed.
 * A handler string is not checked by the compiler, so a renamed or mistyped
 * action would otherwise be a button every operator can press and nobody can
 * use, found the first time someone needed it.
 */
export async function modelActions(Model: any, modelName: string, resolve: ResolveHandler = resolveWithRouter): Promise<ModelActionDefinition[]> {
  const { actions, problems } = modelActionDefinitions(Model)
  const offered: ModelActionDefinition[] = []
  for (const action of actions) {
    const key = `${modelName}:${action.name}:${action.handler}`
    let checked = loadable.get(key)
    if (!checked) {
      checked = resolve(action.handler).then(
        resolved => ({ validations: (resolved as { validations?: unknown } | null | undefined)?.validations }),
        error => ({ failure: error instanceof Error ? error.message : String(error) }),
      )
      loadable.set(key, checked)
    }
    const loaded = await checked
    if ('failure' in loaded) {
      problems.push(`'${action.name}' names ${action.handler}, which could not be loaded (${loaded.failure})`)
      continue
    }
    // What the action takes, as a form. One that requires what no form can
    // give is a button that could only be refused.
    const { fields, unaskable, ignored } = modelActionFields(loaded.validations, action.asking)
    if (unaskable.length > 0) {
      problems.push(`'${action.name}' runs ${action.handler}, which requires ${describeUnaskable(unaskable)}: ${unaskable.length === 1 ? 'a value' : 'values'} a form cannot give (a list, a structure, a file or a password)`)
      continue
    }
    // The action is still offered; only that setting is.
    for (const note of ignored)
      problems.push(`'${action.name}' ${note}`)
    offered.push({ ...action, fields })
  }

  for (const problem of problems) {
    const key = `${modelName}:${problem}`
    if (warned.has(key))
      continue
    warned.add(key)
    console.warn(`[dashboard] ${modelName} dashboard.actions: ${problem}. It is left out.`)
  }
  return offered
}

/** A dashboard path an action may send the page to afterwards. Never an outside address. */
function dashboardPath(value: unknown): string {
  return typeof value === 'string' && /^\/(?!\/)[\w\-/]*(?:\?[\w\-=&%.]*)?$/.test(value) ? value : ''
}

/**
 * What the page is told came of running an action, from the response its own
 * route would have sent.
 *
 * A refusal keeps its status and its words, so the page can say why. A
 * success is reduced to the two things the page acts on: `message`, shown as
 * the confirmation, and `redirect`, a dashboard path to open (the copy that
 * "Duplicate" made). Whatever else the action answers with is its API's
 * business and is not passed along.
 */
export async function modelActionOutcome(result: Response, label: string): Promise<Response | { ok: true, message: string, redirect: string }> {
  const text = await result.text().catch(() => '')
  let body: Record<string, unknown> = {}
  let json = false
  try {
    const parsed = text ? JSON.parse(text) as unknown : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>
      json = true
    }
  }
  catch {}

  if (result.status >= 400) {
    const said = [body.message, body.error].find(value => typeof value === 'string' && value.trim()) as string | undefined
    // A page of HTML or a stack trace is not a sentence for a toast.
    const plain = !json && text.length <= 300 && !text.trimStart().startsWith('<') ? text.trim() : ''
    return response.json({
      message: said || plain || `${label} was refused.`,
      ...(body.errors && typeof body.errors === 'object' ? { errors: body.errors } : {}),
    }, result.status as ResponseStatus)
  }

  return {
    ok: true,
    message: typeof body.message === 'string' ? body.message.trim() : '',
    redirect: dashboardPath(body.redirect),
  }
}
