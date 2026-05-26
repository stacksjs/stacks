/**
 * Mailable preview server backend (stacksjs/stacks#1900, A3 from #1904).
 *
 * Powers the `buddy mail:preview` dev workflow. Given a project that
 * uses `make:mail`-style Mailable subclasses under `app/Mail/*.ts`, this
 * module discovers them, instantiates each with sample props (loaded
 * from `resources/emails/_previews/<kebab-name>.ts` when present), runs
 * `build()`, and returns the rendered HTML/text + the recipient
 * metadata. The route handler (defaults/routes/mail-preview.ts) then
 * renders an HTML preview page around the output.
 *
 * Hot-reload behavior is inherited from `bun --watch dev/api.ts` — the
 * dynamic imports below are not cached across requests so editing a
 * Mailable or template file re-imports on the next refresh.
 *
 * Discovery is gated on `app/Mail/` existing; the routes that consume
 * this module short-circuit on `APP_ENV === production` so production
 * deploys don't expose the preview surface even if the file ends up in
 * the bundle.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { existsSync } from '@stacksjs/storage'
import { userEmailsPath, userMailPath } from '@stacksjs/path'
import { kebabCase } from '@stacksjs/strings'
import { Mailable } from './mailable'
import type { MailableInspection } from './mailable'
import { template } from './template'

/**
 * One Mailable discovered under `app/Mail/`.
 */
export interface DiscoveredMailable {
  /** PascalCase class name (matches the file basename). */
  name: string
  /** Absolute path to the source file. */
  path: string
  /** kebab-case form — matches the convention from `make:mail`. */
  slug: string
}

/**
 * Scan `app/Mail/*.ts` and return the discovered Mailables. Non-`.ts`
 * files (test files, `.d.ts`, etc.) are skipped.
 *
 * Filesystem scan is synchronous + cheap (one directory, no recursion)
 * — fine for a dev-only preview surface; not a hot path.
 */
export function discoverMailables(): DiscoveredMailable[] {
  const dir = userMailPath()
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true })
  const out: DiscoveredMailable[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.d.ts')) continue
    if (entry.name.endsWith('.test.ts')) continue
    if (entry.name.endsWith('.spec.ts')) continue
    const base = entry.name.replace(/\.ts$/, '')
    out.push({
      name: base,
      path: join(dir, entry.name),
      slug: kebabCase(base),
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/**
 * Look up sample props for a Mailable. Convention:
 *
 *   resources/emails/_previews/<slug>.ts
 *     → default export is the props object passed to `new Mailable(props)`
 *
 * Returns `null` when no sample file is present — the caller falls back
 * to instantiating with `{}` so apps without samples still render
 * (defaulted props in the Mailable's build() show their fallback values).
 */
export async function loadSampleProps(slug: string): Promise<Record<string, unknown> | null> {
  const samplePath = userEmailsPath(`_previews/${slug}.ts`)
  if (!existsSync(samplePath)) return null
  try {
    const mod = await import(samplePath)
    const props = mod.default ?? mod.props ?? null
    return props && typeof props === 'object' ? (props as Record<string, unknown>) : null
  }
  catch (err) {
    // Don't fail the preview — surface the error in the UI instead.
    const msg = err instanceof Error ? err.message : String(err)
    return { __preview_error__: `Failed to load sample props: ${msg}` }
  }
}

/**
 * The fully-rendered preview of one Mailable. Returned by
 * {@link renderMailablePreview} and consumed by the preview HTML.
 */
export interface MailablePreview {
  /** Inspection snapshot from `Mailable.inspect()`. */
  inspection: MailableInspection
  /** Rendered HTML body — empty string when no template / build error. */
  html: string
  /** Plain-text version derived from the HTML. */
  text: string
  /** Sample props that were applied (for the "edit your sample" hint). */
  sampleProps: Record<string, unknown> | null
  /** Preview-side render error (template lookup, build() throw, etc.). */
  error?: string
}

/**
 * Render a Mailable to its preview payload. Imports the source file,
 * picks the first exported subclass of `Mailable`, instantiates with
 * sample props (or `{}` when none exist), runs `build()`, and resolves
 * the bound template through `template()` from this same package.
 *
 * Errors at any step (import failure, no Mailable export, build()
 * throws, template not found) are returned as `error` on the preview
 * payload rather than thrown — the route layer renders them as part
 * of the UI so the user sees what broke.
 */
export async function renderMailablePreview(mailable: DiscoveredMailable): Promise<MailablePreview> {
  const empty: MailablePreview = {
    inspection: { to: [], cc: [], bcc: [], attachments: [] },
    html: '',
    text: '',
    sampleProps: null,
  }
  try {
    const mod = await import(mailable.path) as Record<string, unknown>
    const Cls = pickMailableConstructor(mod)
    if (!Cls) {
      return { ...empty, error: `No subclass of \`Mailable\` exported from ${mailable.path}.` }
    }

    const sampleProps = await loadSampleProps(mailable.slug)
    const instance = new Cls(sampleProps ?? {}) as Mailable
    if (!(instance instanceof Mailable)) {
      return { ...empty, sampleProps, error: 'Constructor did not produce a Mailable instance.' }
    }

    await instance.build()
    const inspection = instance.inspect()

    if (!inspection.template) {
      // Mailable that builds an inline `html()` / `text()` body — render
      // those directly without invoking the template engine.
      return {
        inspection,
        html: inspection.html ?? '',
        text: inspection.text ?? '',
        sampleProps,
      }
    }

    const rendered = await template(inspection.template.name, {
      variables: inspection.template.props as never,
      subject: inspection.subject,
    })
    return {
      inspection,
      html: rendered.html,
      text: rendered.text,
      sampleProps,
    }
  }
  catch (err) {
    return { ...empty, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
  }
}

/**
 * Find the first exported constructor that extends `Mailable` in a
 * dynamically-imported Mailable source file. Tries the `default`
 * export first (the make:mail scaffolder emits it as a named export
 * via `export class`, but a manual `export default class` is just as
 * common), then walks every named export.
 */
function pickMailableConstructor(mod: Record<string, unknown>): (new (props?: Record<string, unknown>) => Mailable) | null {
  const candidates: unknown[] = []
  if (mod.default) candidates.push(mod.default)
  for (const key of Object.keys(mod)) {
    if (key !== 'default') candidates.push(mod[key])
  }
  for (const candidate of candidates) {
    if (typeof candidate !== 'function') continue
    if (!(candidate.prototype instanceof Mailable)) continue
    // eslint-disable-next-line pickier/no-unused-vars -- `props` names the constructor arg for readability in the cast type.
    return candidate as new (props?: Record<string, unknown>) => Mailable
  }
  return null
}
