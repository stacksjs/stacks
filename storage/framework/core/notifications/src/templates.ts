/**
 * Localized notification templates: a catalog of named messages, each with
 * its copy in every language the app speaks and the email's button, rendered
 * into the `{ subject, body, action }` that `notify()` sends.
 *
 * ```ts
 * import { accountNotificationTemplates, createNotificationTemplates, defineNotificationTemplates } from '@stacksjs/notifications/templates'
 *
 * const templates = createNotificationTemplates({
 *   ...accountNotificationTemplates(),
 *   ...defineNotificationTemplates({
 *     class_booked: {
 *       copy: {
 *         en: { subject: 'You’re booked', body: 'See you at {{class_name}} on {{date}}.' },
 *         de: { subject: 'Du bist gebucht', body: 'Bis {{date}} bei {{class_name}}.' },
 *       },
 *       action: { path: '/schedule', label: { en: 'View your schedule', de: 'Zum Stundenplan' } },
 *     },
 *   }),
 * }, { baseUrl: 'https://example.com' })
 *
 * templates.render('class_booked', { class_name: 'Strength', date: '2026-07-20' }, 'de')
 * ```
 *
 * `{{name}}` in a subject, body or button path is replaced by that variable
 * (a missing one by nothing). A button whose path needs a variable that was
 * not given is left out rather than sent half-built. A path that renders to an
 * absolute URL is used as it is; any other is joined to `baseUrl`.
 *
 * Pure and browser-safe: no database, config or mail imports.
 */

export {
  accountNotificationTemplates,
  type AccountNotificationPaths,
  type AccountNotificationTemplateName,
} from './template-catalogs/account'
export {
  commerceNotificationTemplates,
  type CommerceNotificationPaths,
  type CommerceNotificationTemplateName,
} from './template-catalogs/commerce'
export {
  subscriptionNotificationTemplates,
  type SubscriptionNotificationPaths,
  type SubscriptionNotificationTemplateName,
} from './template-catalogs/subscription'

/** One language's copy of a message. */
export interface NotificationTemplateCopy {
  subject: string
  body: string
}

/** The email's button: where it leads (a path or URL) and its label per language. */
export interface NotificationTemplateAction {
  path: string
  label: Record<string, string>
}

/** A named message: its copy per language and, optionally, a button. */
export interface NotificationTemplateDefinition {
  copy: Record<string, NotificationTemplateCopy>
  action?: NotificationTemplateAction
}

/** What a template renders to: the payload `notify()` takes. */
export interface RenderedNotificationTemplate {
  subject: string
  body: string
  /** Absent when the template has no button, or its link needs a variable that was not given. */
  action?: { label: string, url: string }
}

export interface RenderNotificationTemplateOptions {
  /** The recipient's language. `de-AT` falls back to `de`, then to `fallbackLocale`. */
  locale?: string | null
  /** Used when the template has no copy in `locale`. Defaults to `en`. */
  fallbackLocale?: string
  /** Joined to a relative button path, without a trailing slash. */
  baseUrl?: string
}

export type NotificationTemplateVariables = Record<string, unknown>

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

/**
 * Declare a catalog. Returns it unchanged; the point is the checked shape and
 * the literal names, so `render('nmae')` is a type error.
 */
export function defineNotificationTemplates<const T extends Record<string, NotificationTemplateDefinition>>(templates: T): T {
  return templates
}

/** Replace every `{{name}}` with that variable; a missing or null one becomes empty. */
export function interpolateNotificationText(text: string, variables: NotificationTemplateVariables = {}): string {
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}

/** The variables a text refers to, in order of first use. */
export function notificationTemplateVariables(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map(match => match[1]!))]
}

/** The language a template is rendered in: exact, then the base language, then the fallback, then its first. */
export function resolveNotificationLocale(available: readonly string[], locale?: string | null, fallbackLocale = 'en'): string {
  const wanted = String(locale || '').trim()
  if (wanted && available.includes(wanted))
    return wanted
  const base = wanted.split(/[-_]/)[0]?.toLowerCase()
  if (base && available.includes(base))
    return base
  if (available.includes(fallbackLocale))
    return fallbackLocale
  const first = available[0]
  if (!first)
    throw new Error('A notification template needs copy in at least one language')
  return first
}

function joinUrl(baseUrl: string | undefined, path: string): string {
  if (/^https?:\/\//i.test(path))
    return path
  const base = String(baseUrl || '').replace(/\/+$/, '')
  if (!path)
    return base
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Render one template definition for one recipient. */
export function renderNotificationTemplate(
  definition: NotificationTemplateDefinition,
  variables: NotificationTemplateVariables = {},
  options: RenderNotificationTemplateOptions = {},
): RenderedNotificationTemplate {
  const fallbackLocale = options.fallbackLocale || 'en'
  const language = resolveNotificationLocale(Object.keys(definition.copy), options.locale, fallbackLocale)
  const copy = definition.copy[language]!
  const rendered: RenderedNotificationTemplate = {
    subject: interpolateNotificationText(copy.subject, variables),
    body: interpolateNotificationText(copy.body, variables),
  }
  const action = definition.action
  if (action) {
    const missing = notificationTemplateVariables(action.path).some(key => variables[key] == null || variables[key] === '')
    const label = action.label[language] ?? action.label[fallbackLocale] ?? Object.values(action.label)[0]
    if (!missing && label)
      rendered.action = { label, url: joinUrl(options.baseUrl, interpolateNotificationText(action.path, variables)) }
  }
  return rendered
}

export interface NotificationTemplateCatalogOptions {
  /** The app's URL, or a function read at render time (so a changed env is picked up). */
  baseUrl?: string | (() => string)
  /** Defaults to `en`. */
  fallbackLocale?: string
}

export interface NotificationTemplateCatalog<T extends Record<string, NotificationTemplateDefinition>> {
  /** The catalog as declared. */
  readonly templates: T
  /** Every template name, for validating input. */
  readonly names: Array<keyof T & string>
  has: (name: string) => name is keyof T & string
  render: (name: keyof T & string, variables?: NotificationTemplateVariables, locale?: string | null) => RenderedNotificationTemplate
}

/** A catalog bound to the app's URL and fallback language. */
export function createNotificationTemplates<const T extends Record<string, NotificationTemplateDefinition>>(
  templates: T,
  options: NotificationTemplateCatalogOptions = {},
): NotificationTemplateCatalog<T> {
  const names = Object.keys(templates) as Array<keyof T & string>
  const baseUrl = () => (typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl)
  return {
    templates,
    names,
    has: (name: string): name is keyof T & string => Object.hasOwn(templates, name),
    render(name, variables = {}, locale) {
      const definition = templates[name]
      if (!definition)
        throw new Error(`Unknown notification template "${String(name)}"`)
      return renderNotificationTemplate(definition, variables, { locale, fallbackLocale: options.fallbackLocale, baseUrl: baseUrl() })
    },
  }
}
