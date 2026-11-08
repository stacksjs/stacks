/** Bun port of the upstream MIT-licensed conversion recipe builder; see ../NOTICE.md. */
import { parseArgs } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Tag {
  tagId: string
  firingTriggerId?: string[]
}
interface Container {
  containerVersion: {
    container: { name: string }
    trigger: { type: string, triggerId: string }[]
    tag: Tag[]
    variable?: { variableId: string }[]
  }
}

const assets = join(import.meta.dir, '../assets/gtm-recipes')
const formats: Record<string, RegExp> = {
  google_ads_id: /^[0-9]{6,15}$/,
  google_ads_label: /^[A-Za-z0-9_-]{1,64}$/,
  ga4_id: /^G-[A-Z0-9]{4,20}$/,
  meta_pixel: /^[0-9]{6,20}$/,
  tiktok_pixel: /^[A-Z0-9]{10,30}$/,
  linkedin_partner: /^[0-9]{1,15}$/,
  linkedin_conversion: /^[0-9]{1,15}$/,
  uet_tag: /^[0-9]{4,15}$/,
  event_name: /^[A-Za-z][A-Za-z0-9_]{0,49}$/,
  ga4_event_name: /^[A-Za-z][A-Za-z0-9_]{0,39}$/,
  microsoft_event_action: /^(?!.*__)[A-Za-z0-9](?:[A-Za-z0-9 _.-]{0,98}[A-Za-z0-9_.-])?$/,
}

function validate(value: string | undefined, kind: string, flag: string): string {
  if (!value || !formats[kind]?.test(value) || /[\x00-\x1F\x7F]/.test(value))
    throw new Error(`Invalid or missing ${flag} (${kind}).`)
  return value
}

function escapeHtmlScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/</g, '\\x3c').replace(/>/g, '\\x3e')
}

function substitute(node: unknown, tokens: Record<string, string>, inHtml = false): unknown {
  if (Array.isArray(node))
    return node.map(value => substitute(value, tokens, inHtml))
  if (node && typeof node === 'object') {
    const object = node as Record<string, unknown>
    return Object.fromEntries(Object.entries(object).map(([key, value]) => [
      key, substitute(value, tokens, inHtml || (object.key === 'html' && key === 'value')),
    ]))
  }
  if (typeof node === 'string') {
    let text = node
    for (const [token, value] of Object.entries(tokens))
      text = text.replaceAll(token, inHtml ? escapeHtmlScript(value) : value)
    return text
  }
  return node
}

/** Build a local import file only. This does not publish tags or send conversions. */
export function buildRecipe(options: Record<string, string | undefined>): Container {
  const events = JSON.parse(readFileSync(join(assets, 'event-map.json'), 'utf8')) as Record<string, { label: string, event: string }>
  const tool = options.tool ? events[options.tool] : undefined
  if (!tool || !Object.hasOwn(events, options.tool!))
    throw new Error('Choose a --tool from assets/gtm-recipes/event-map.json.')
  const tokens: Record<string, string> = {
    __RECIPE_LABEL__: tool.label,
    __DETECTION_EVENT__: tool.event,
  }
  const eventName = (fallback: string, kind = 'event_name'): string => validate(options['event-name'] ?? fallback, kind, '--event-name')
  switch (options.send) {
    case 'google-ads':
      tokens.__GOOGLE_ADS_CONVERSION_ID__ = validate(options['conversion-id']?.trim().replace(/^AW-/i, ''), 'google_ads_id', '--conversion-id')
      tokens.__GOOGLE_ADS_CONVERSION_LABEL__ = validate(options['conversion-label']?.trim(), 'google_ads_label', '--conversion-label')
      break
    case 'ga4':
      tokens.__GA4_MEASUREMENT_ID__ = validate(options['measurement-id']?.trim().toUpperCase(), 'ga4_id', '--measurement-id')
      tokens.__GA4_EVENT_NAME__ = eventName('generate_lead', 'ga4_event_name')
      break
    case 'meta':
      tokens.__META_PIXEL_ID__ = validate(options['pixel-id']?.trim(), 'meta_pixel', '--pixel-id')
      tokens.__META_EVENT_NAME__ = eventName('Lead')
      break
    case 'tiktok':
      tokens.__TIKTOK_PIXEL_ID__ = validate(options['pixel-id']?.trim().toUpperCase(), 'tiktok_pixel', '--pixel-id')
      tokens.__TIKTOK_EVENT_NAME__ = eventName('SubmitForm')
      break
    case 'linkedin':
      tokens.__LINKEDIN_PARTNER_ID__ = validate(options['partner-id']?.trim(), 'linkedin_partner', '--partner-id')
      tokens.__LINKEDIN_CONVERSION_ID__ = validate(options['conversion-id']?.trim(), 'linkedin_conversion', '--conversion-id')
      break
    case 'microsoft':
      tokens.__MICROSOFT_UET_TAG_ID__ = validate(options['uet-tag-id']?.trim(), 'uet_tag', '--uet-tag-id')
      tokens.__MICROSOFT_EVENT_ACTION__ = eventName('submit_lead_form', 'microsoft_event_action')
      break
    default:
      throw new Error('Choose --send google-ads, ga4, meta, tiktok, linkedin or microsoft.')
  }
  const detect = JSON.parse(readFileSync(join(assets, `detect/detect-${options.tool}.json`), 'utf8')) as Container
  const send = JSON.parse(readFileSync(join(assets, `send/${options.send}.json`), 'utf8')) as Container
  const target = detect.containerVersion
  const trigger = target.trigger.find(item => ['CUSTOM_EVENT', 'customEvent'].includes(item.type))
  if (!trigger)
    throw new Error('The detection recipe has no custom-event trigger.')
  const sendIds = new Set(send.containerVersion.trigger.map(item => item.triggerId))
  let nextId = 1000
  for (const tag of send.containerVersion.tag) {
    tag.tagId = String(nextId++)
    tag.firingTriggerId = tag.firingTriggerId?.map(id => sendIds.has(id) ? trigger.triggerId : id)
    target.tag.push(tag)
  }
  for (const variable of send.containerVersion.variable ?? []) {
    variable.variableId = String(nextId++)
    ;(target.variable ??= []).push(variable)
  }
  target.container.name = `Conversion Tracking - ${tool.label} to ${options.send}`
  const result = substitute(detect, tokens) as Container
  if (/__[A-Z0-9]+(?:_[A-Z0-9]+)*__/.test(JSON.stringify(result)))
    throw new Error('Unreplaced placeholder tokens remain in the recipe.')
  return result
}

if (import.meta.main) {
  try {
    const names = ['tool', 'send', 'conversion-id', 'conversion-label', 'measurement-id', 'pixel-id', 'partner-id', 'uet-tag-id', 'event-name', 'out']
    const { values } = parseArgs({ args: process.argv.slice(2), options: Object.fromEntries(names.map(name => [name, { type: 'string' as const, ...(name === 'out' ? { short: 'o' } : {}) }])) })
    const container = buildRecipe(values)
    const out = values.out ?? 'conversion-tracking-import.json'
    writeFileSync(out, `${JSON.stringify(container, null, 2)}\n`)
    console.log(`Wrote ${out}. Review the file, then import into an existing GTM workspace using MERGE.`)
    console.log('Review consent settings and remove duplicate base pixels or Conversion Linker tags before publishing.')
  }
  catch (err) {
    console.error((err as Error).message)
    process.exitCode = 1
  }
}
