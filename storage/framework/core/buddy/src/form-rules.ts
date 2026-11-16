/**
 * Forms a page cannot submit (stacksjs/stacks#3311).
 *
 * An HTML form sends text, files, and a name repeated for a list. An action's
 * `validations` can ask for more than that: an object, a required yes or no
 * that only a checkbox sends, a value no option on the page carries. Each is
 * a form the person fills in correctly and is refused every time, and nothing
 * said so: the rule and the page are two files, and each looks right alone.
 *
 * This reads every page's plain POST forms, finds the action each one posts
 * to in the app's own route table, and reports the rules that form cannot
 * meet. `buddy doctor` shows it.
 */
import type { ActionValidations } from '@stacksjs/actions'

/** One named control of a form, by what it can send. */
export interface FormField {
  /** The kinds of control that send this name: `checkbox`, `radio`, `hidden`, `select`, `text`... */
  kinds: Set<string>
  /** The values written on the page for it: a checkbox's, a radio's, an option's. */
  values: string[]
  /** Whether a value is computed when the page is drawn, so it cannot be read here. */
  computed: boolean
}

/** A plain form on a page, posting to an address written on that page. */
export interface ViewForm {
  file: string
  line: number
  action: string
  method: string
  fields: Map<string, FormField>
}

/** The values a boolean rule takes from a form (core/router getRequestInput). */
const BOOLEAN_FORM_VALUES = new Set(['true', '1', 'on', 'false', '0'])

function attributes(source: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of source.matchAll(/([:@\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    found.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? '')
  return found
}

function computedValue(value: string): boolean {
  return value.includes('{{') || value.includes('{!!')
}

/**
 * The plain POST forms in a page's source: an `action` and a `method` written
 * as text, and the controls inside with names written as text. A form whose
 * address is computed is left out: it cannot be paired with a route here.
 */
export function parseViewForms(source: string, file: string): ViewForm[] {
  const forms: ViewForm[] = []
  for (const match of source.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = attributes(match[1]!)
    const action = attrs.get('action')
    const method = (attrs.get('method') ?? 'get').toUpperCase()
    if (!action || computedValue(action) || attrs.has(':action') || method !== 'POST')
      continue

    const fields = new Map<string, FormField>()
    const field = (name: string): FormField => {
      const key = name.endsWith('[]') ? name.slice(0, -2) : name
      let entry = fields.get(key)
      if (!entry)
        fields.set(key, entry = { kinds: new Set(), values: [], computed: false })
      return entry
    }

    const body = match[2]!
    for (const control of body.matchAll(/<(input|select|textarea|button)\b([^>]*)>/gi)) {
      const tag = control[1]!.toLowerCase()
      const controlAttrs = attributes(control[2]!)
      const name = controlAttrs.get('name')
      if (!name || computedValue(name) || controlAttrs.has(':name'))
        continue
      const type = tag === 'input' ? (controlAttrs.get('type') ?? 'text').toLowerCase() : tag
      const entry = field(name)
      entry.kinds.add(type)
      const value = controlAttrs.get('value')
      if (controlAttrs.has(':value') || (value !== undefined && computedValue(value)))
        entry.computed = true
      else if (type === 'checkbox')
        entry.values.push(value ?? 'on')
      else if ((type === 'radio' || type === 'button' || type === 'submit') && value !== undefined)
        entry.values.push(value)

      if (tag === 'select') {
        const end = body.indexOf('</select>', (control.index ?? 0))
        const options = body.slice(control.index ?? 0, end === -1 ? undefined : end)
        for (const option of options.matchAll(/<option\b([^>]*)>([^<]*)/gi)) {
          const optionValue = attributes(option[1]!).get('value') ?? option[2]!.trim()
          if (computedValue(optionValue) || attributes(option[1]!).has(':value'))
            entry.computed = true
          else
            entry.values.push(optionValue)
        }
      }
    }

    forms.push({ file, line: source.slice(0, match.index).split('\n').length, action, method, fields })
  }
  return forms
}

interface RuleShape {
  name?: string
  isRequired?: boolean
  allowedValues?: unknown[]
}

/**
 * What in `validations` this form cannot satisfy, one sentence each.
 * `supplied` names what arrives some other way: the route's own parameters
 * and the query string written in the form's address.
 */
export function unmetFormRules(form: ViewForm, validations: ActionValidations, supplied: ReadonlySet<string> = new Set()): string[] {
  const unmet: string[] = []
  for (const [name, validation] of Object.entries(validations)) {
    const rule = (validation as { rule?: RuleShape })?.rule
    if (!rule || typeof rule !== 'object' || supplied.has(name))
      continue
    const sent = form.fields.get(name)

    if (rule.name === 'object') {
      unmet.push(`\`${name}\` must be an object, and a form sends only text, files and lists of them`)
      continue
    }
    if (rule.isRequired && !sent) {
      unmet.push(`\`${name}\` is required, and this form has no control named \`${name}\``)
      continue
    }
    if (!sent || sent.computed)
      continue

    if (rule.name === 'boolean') {
      const onlyCheckboxes = [...sent.kinds].every(kind => kind === 'checkbox')
      if (rule.isRequired && onlyCheckboxes)
        unmet.push(`\`${name}\` is a required yes or no sent only by a checkbox, which sends nothing when it is not ticked`)
      for (const value of sent.values) {
        if (!BOOLEAN_FORM_VALUES.has(value))
          unmet.push(`\`${name}\` must be a yes or no, and the page sends "${value}" for it`)
      }
    }
    else if (rule.name === 'enum' && Array.isArray(rule.allowedValues)) {
      const allowed = new Set(rule.allowedValues.map(String))
      for (const value of sent.values) {
        if (value !== '' && !allowed.has(value))
          unmet.push(`\`${name}\` must be one of ${[...allowed].map(entry => `"${entry}"`).join(', ')}, and the page offers "${value}"`)
      }
    }
  }
  return unmet
}

/** A path as a route writes it (`/posts/{id}`, `/posts/:id`), as a pattern. */
function routePattern(path: string): RegExp {
  const escaped = path
    .split(/(\{[^}]+\}|:[A-Za-z_]\w*)/)
    .map((part, index) => index % 2 === 1 ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('')
  return new RegExp(`^${escaped}/?$`)
}

export interface FormRuleRoute {
  method: string
  path: string
  validations: ActionValidations | undefined
}

/** Pair each form with the route it posts to, and say what none of them can meet. */
export function describeFormRules(forms: ViewForm[], routes: FormRuleRoute[]): { status: 'pass' | 'warn', message: string } {
  const posting = routes
    .filter(route => route.method.toUpperCase() === 'POST')
    .map(route => ({ ...route, pattern: routePattern(route.path) }))
  const problems: string[] = []
  let checked = 0
  for (const form of forms) {
    if (!form.action.startsWith('/') || form.action.startsWith('//'))
      continue
    const path = form.action.split(/[?#]/)[0]!
    const route = posting.find(candidate => candidate.pattern.test(path))
    if (!route?.validations)
      continue
    checked++
    const supplied = new Set([
      ...[...route.path.matchAll(/\{([^}?]+)\??\}|:([A-Za-z_]\w*)/g)].map(match => match[1] ?? match[2]!),
      ...new URLSearchParams(form.action.split('?')[1]?.split('#')[0] ?? '').keys(),
    ])
    for (const sentence of unmetFormRules(form, route.validations, supplied))
      problems.push(`${form.file}:${form.line} posts to ${path}: ${sentence}`)
  }
  if (problems.length === 0)
    return { status: 'pass', message: `${checked} form${checked === 1 ? '' : 's'} can meet the rules of the action ${checked === 1 ? 'it posts' : 'they post'} to` }
  return {
    status: 'warn',
    message: `${problems.length} rule${problems.length === 1 ? '' : 's'} a page's form cannot meet, so the form is refused however it is filled in:\n${problems.map(line => `  ${line}`).join('\n')}`,
  }
}

/** Every `.stx` page and component this app draws, an app file shadowing the default of the same path. */
export async function collectViewForms(root: string): Promise<ViewForm[]> {
  const { existsSync, readFileSync } = await import('node:fs')
  const { join, relative } = await import('node:path')
  const seen = new Set<string>()
  const forms: ViewForm[] = []
  for (const base of [join(root, 'resources'), join(root, 'storage/framework/defaults/resources')]) {
    for (const folder of ['views', 'components']) {
      const directory = join(base, folder)
      if (!existsSync(directory))
        continue
      for (const file of new Bun.Glob('**/*.stx').scanSync({ cwd: directory })) {
        const key = `${folder}/${file}`
        if (seen.has(key))
          continue
        seen.add(key)
        const path = join(directory, file)
        forms.push(...parseViewForms(readFileSync(path, 'utf8'), relative(root, path)))
      }
    }
  }
  return forms
}

/** The check `buddy doctor` runs: this app's forms against this app's routes. */
export async function collectFormRuleReport(root: string): Promise<{ status: 'pass' | 'warn', message: string }> {
  const forms = await collectViewForms(root)
  if (forms.length === 0)
    return { status: 'pass', message: 'No page posts a plain form' }

  const router = await import('@stacksjs/router')
  const { existingRouteFiles } = await import('./hq-routes')
  await router.loadRoutes(await existingRouteFiles(await router.appRouteRegistry()))
  const routes: FormRuleRoute[] = []
  for (const route of router.listRegisteredRoutes()) {
    if (route.method.toUpperCase() !== 'POST')
      continue
    let validations: ActionValidations | undefined
    try {
      validations = (route.action?.validations ?? (route.handler ? await router.resolveActionValidations(route.handler) : undefined)) as ActionValidations | undefined
    }
    catch {
      // An action that does not load is reported by the server, not here.
    }
    routes.push({ method: route.method, path: route.path, validations })
  }
  return describeFormRules(forms, routes)
}
