import type { EmailAddress, EmailAttachment, EmailMessage, EmailResult } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { mail } from './email'
import { template as renderTemplate } from './template'

/**
 * Allowed recipient input — accepts a single address, an array of addresses,
 * or already-shaped {@link EmailAddress} objects. Strings are treated as
 * `address` only (no display name).
 */
export type MailableAddressInput = string | string[] | EmailAddress | EmailAddress[]

/**
 * Options accepted by {@link Mailable.send} — currently allows scoping
 * the send to a specific driver registered on the Mail singleton (e.g.
 * `'log'` to swallow the email in a test, `'ses'` to force production
 * delivery during a one-off backfill).
 */
export interface MailableSendOptions {
  /** Optional driver name to use for this send (overrides the default). */
  driver?: string
}

/**
 * Internal stash for template rendering — populated by {@link Mailable.template}
 * and consumed in {@link Mailable.send} after `build()` resolves.
 */
/**
 * Read-only snapshot of a Mailable's build state — produced by
 * {@link Mailable.inspect}. Used by the preview server (#1900) so the
 * UI can render what the email WOULD look like without dispatching.
 *
 * Generic over `TProps` so typed Mailables expose typed template
 * props (stacksjs/stacks#1903). Defaults to `Record<string, unknown>`
 * so untyped usages keep working without changes.
 */
export interface MailableInspection<TProps extends Record<string, unknown> = Record<string, unknown>> {
  to: string[] | EmailAddress[]
  cc: string[] | EmailAddress[]
  bcc: string[] | EmailAddress[]
  from?: EmailAddress
  replyTo?: EmailAddress
  subject?: string
  text?: string
  html?: string
  template?: { name: string, props: TProps }
  attachments: EmailAttachment[]
}

interface TemplateRef<TProps extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  props: TProps
}

/**
 * `true` iff `T` is the loose default (`Record<string, unknown>`),
 * i.e. the caller didn't specialize the generic. Used to make
 * `Mailable#template(name)` props-optional in the loose case and
 * props-required when a concrete `TProps` is supplied.
 */
type IsLooseProps<T> = Record<string, unknown> extends T ? true : false

/**
 * Builds the variadic tail of {@link Mailable.template}'s parameter list.
 * Untyped Mailable accepts `.template('name')`; typed `Mailable<P>` must
 * pass props matching `P`.
 */
type TemplateArgs<T extends Record<string, unknown>> =
  IsLooseProps<T> extends true ? [props?: T] : [props: T]

/**
 * Laravel-style class-based email definition. Subclass `Mailable`,
 * implement `build()`, and call `.send()` to dispatch.
 *
 * Compared to the existing function-form `Email` / direct `mail.send()`
 * APIs this gives you:
 *  - encapsulation of recipient/subject/body building per email type
 *  - chainable, immutable-feeling fluent setters
 *  - a single hook (`build`) where view-model -> message translation happens
 *  - automatic STX template rendering via the existing `template()` helper
 *
 * The class still ultimately routes through the same `mail` singleton, so
 * configured drivers, queueing, and `from` defaults all behave identically.
 *
 * @example
 * ```ts
 * import { Mailable } from '@stacksjs/email'
 *
 * export default class WelcomeMail extends Mailable {
 *   constructor(private user: { name: string, email: string }) { super() }
 *
 *   build() {
 *     return this
 *       .to(this.user.email)
 *       .subject('Welcome!')
 *       .template('welcome', { name: this.user.name })
 *   }
 * }
 *
 * await new WelcomeMail(user).send()
 * ```
 */
export abstract class Mailable<TProps extends Record<string, unknown> = Record<string, unknown>> {
  /** Recipient list — homogeneous string[] or EmailAddress[] to match `EmailMessage.to`. */
  protected _to: string[] | EmailAddress[] = []
  protected _cc: string[] | EmailAddress[] = []
  protected _bcc: string[] | EmailAddress[] = []
  protected _replyTo?: EmailAddress
  protected _from?: EmailAddress
  protected _subject?: string
  protected _text?: string
  protected _html?: string
  protected _template?: TemplateRef<TProps>
  protected _attachments: EmailAttachment[] = []

  /**
   * Subclass hook — populate this Mailable with recipient/subject/body via
   * the chainable setters, then return `this` (or a Promise resolving to
   * `this` for async lookups). Called by {@link Mailable.send} before the
   * message is dispatched.
   *
   * @example
   * ```ts
   * build() {
   *   return this.to(this.user.email).subject('Hi').template('hello', { name: this.user.name })
   * }
   * ```
   */
  abstract build(): this | Promise<this>

  /**
   * Add one or more "To" recipients. Replaces any previously set recipients
   * to keep semantics simple — call this once per Mailable.
   *
   * @example
   * ```ts
   * this.to('user@example.com')
   * this.to(['a@x.com', 'b@x.com'])
   * this.to({ name: 'Ada', address: 'ada@example.com' })
   * ```
   */
  to(address: MailableAddressInput): this {
    this._to = normalizeAddresses(address)
    return this
  }

  /**
   * Add CC recipients. Replaces previously set CC list.
   *
   * @example
   * ```ts
   * this.cc('manager@example.com')
   * ```
   */
  cc(address: MailableAddressInput): this {
    this._cc = normalizeAddresses(address)
    return this
  }

  /**
   * Add BCC recipients. Replaces previously set BCC list.
   *
   * @example
   * ```ts
   * this.bcc(['audit@example.com'])
   * ```
   */
  bcc(address: MailableAddressInput): this {
    this._bcc = normalizeAddresses(address)
    return this
  }

  /**
   * Set the Reply-To address — drivers map this to the standard `Reply-To`
   * header where supported. Accepts a string or {@link EmailAddress}.
   *
   * @example
   * ```ts
   * this.replyTo({ name: 'Support', address: 'support@example.com' })
   * ```
   */
  replyTo(address: string | EmailAddress): this {
    this._replyTo = typeof address === 'string' ? { address } : address
    return this
  }

  /**
   * Override the sender. When omitted the Mail singleton fills this from
   * `config.email.from`, so most apps shouldn't need to call this at all.
   *
   * @example
   * ```ts
   * this.from({ name: 'Billing', address: 'billing@example.com' })
   * ```
   */
  from(addr: EmailAddress): this {
    this._from = addr
    return this
  }

  /**
   * Set the subject line.
   *
   * @example
   * ```ts
   * this.subject('Your invoice is ready')
   * ```
   */
  subject(s: string): this {
    this._subject = s
    return this
  }

  /**
   * Provide a plain-text body. Recommended for accessibility / spam filters
   * even when an HTML body is also set; if you only set a template, the
   * template renderer produces both `html` and `text` automatically.
   *
   * @example
   * ```ts
   * this.text('Welcome to Stacks!')
   * ```
   */
  text(body: string): this {
    this._text = body
    return this
  }

  /**
   * Provide a raw HTML body. Mutually exclusive with {@link Mailable.template}
   * in practice — whichever is set last wins.
   *
   * @example
   * ```ts
   * this.html('<p>Welcome to Stacks!</p>')
   * ```
   */
  html(body: string): this {
    this._html = body
    return this
  }

  /**
   * Render an STX (or HTML) template by name, with the given props. Resolved
   * via the existing `template()` helper at send time, so it picks up STX
   * directives, layouts, and all configured default variables.
   *
   * Subclasses of `Mailable<TProps>` type-check `props` against `TProps`.
   * Subclasses of plain `Mailable` (the default `Record<string, unknown>`
   * generic) accept any object literal and may also omit `props` entirely.
   *
   * @example
   * ```ts
   * // Untyped (back-compat path):
   * class Loose extends Mailable {
   *   build() { return this.template('hello', { anything: 1 }) }
   * }
   *
   * // Typed (stacksjs/stacks#1903):
   * interface Props { userName: string }
   * class Welcome extends Mailable<Props> {
   *   build() { return this.template('welcome', { userName: 'Ada' }) }
   * }
   * ```
   */
  template(name: string, ...rest: TemplateArgs<TProps>): this {
    const props = (rest[0] ?? {}) as TProps
    this._template = { name, props }
    return this
  }

  /**
   * Read-only snapshot of the Mailable's build state — recipients,
   * subject, template binding, body, attachments. Used by the
   * `buddy mail:preview` dev server (stacksjs/stacks#1900) to render
   * what the email WOULD look like without actually dispatching it.
   *
   * Returns the protected fields verbatim (no copies of mutable arrays
   * — the caller shouldn't mutate the snapshot since the Mailable may
   * still be sent). Wraps the access so external preview tooling
   * doesn't need to `as any`-cast through the protected slot.
   */
  inspect(): MailableInspection<TProps> {
    return {
      to: this._to,
      cc: this._cc,
      bcc: this._bcc,
      from: this._from,
      replyTo: this._replyTo,
      subject: this._subject,
      text: this._text,
      html: this._html,
      template: this._template,
      attachments: this._attachments,
    }
  }

  /**
   * Attach a file from the local filesystem. Reads the file at send time
   * (not at attach time) so the bytes are fresh.
   *
   * @example
   * ```ts
   * this.attach('/tmp/invoice-42.pdf', 'invoice.pdf')
   * ```
   */
  attach(path: string, name?: string): this {
    // Bun.file is sync-friendly but reading bytes is async — defer the read
    // to send time by stashing a placeholder + resolving in `send()`. We
    // store the path under `content` and re-shape during dispatch.
    this._attachments.push({
      filename: name || basename(path),
      // Marker — replaced with the real bytes in `materializeAttachments`.
      content: `__file__:${path}`,
      encoding: 'binary',
    })
    return this
  }

  /**
   * Attach an in-memory buffer. Useful when generating PDFs/CSVs on the fly
   * without touching disk.
   *
   * @example
   * ```ts
   * this.attachData(pdfBuffer, 'report.pdf', 'application/pdf')
   * ```
   */
  attachData(buffer: Uint8Array | string, name: string, mime?: string): this {
    this._attachments.push({
      filename: name,
      content: buffer,
      contentType: mime,
      encoding: typeof buffer === 'string' ? 'utf8' : 'binary',
    })
    return this
  }

  /**
   * Build the Mailable (calling the subclass `build()`), then dispatch
   * through the existing Mail singleton. Returns the driver's
   * {@link EmailResult}.
   *
   * @example
   * ```ts
   * const result = await new WelcomeMail(user).send()
   * if (!result.success) console.error(result.message)
   * ```
   */
  async send(options: MailableSendOptions = {}): Promise<EmailResult> {
    await Promise.resolve(this.build())

    if (this._to.length === 0)
      throw new Error('[Mailable] no recipients — call this.to(...) inside build()')

    if (!this._subject)
      throw new Error('[Mailable] no subject — call this.subject(...) inside build()')

    // Render the template (if provided) into html + text. Direct html/text
    // setters take precedence so apps can override the rendered output if
    // they want to (e.g. a quick raw-HTML retry path).
    let html = this._html
    let text = this._text
    if (this._template) {
      const rendered = await renderTemplate(this._template.name, {
        variables: this._template.props as Record<string, string | number | boolean | undefined | null>,
        subject: this._subject,
      })
      if (!html) html = rendered.html
      if (!text) text = rendered.text
    }

    const message: EmailMessage = {
      to: this._to,
      subject: this._subject,
      from: this._from || resolveDefaultFrom(),
      ...(this._cc.length ? { cc: this._cc } : {}),
      ...(this._bcc.length ? { bcc: this._bcc } : {}),
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
      ...(this._attachments.length
        ? { attachments: await materializeAttachments(this._attachments) }
        : {}),
    }

    // `replyTo` is now a first-class field on `EmailMessage`
    // (stacksjs/stacks#1871 M-4) — drivers consume it directly. The
    // previous `as any` stash is gone.
    if (this._replyTo) {
      message.replyTo = this._replyTo
    }

    const transport = options.driver ? mail.use(options.driver) : mail
    return transport.send(message)
  }
}

/**
 * Normalize the various accepted shapes into a homogeneous array. We
 * coerce to `EmailAddress[]` if any entry is an object, and `string[]`
 * otherwise — matching `EmailMessage.to`'s union (which doesn't allow
 * mixing).
 */
function normalizeAddresses(input: MailableAddressInput): string[] | EmailAddress[] {
  const arr = Array.isArray(input) ? input : [input]
  const hasObject = arr.some(a => typeof a === 'object' && a !== null)
  if (hasObject) {
    return arr.map(a => (typeof a === 'string' ? { address: a } : a)) as EmailAddress[]
  }
  return arr as string[]
}

function resolveDefaultFrom(): EmailAddress {
  return {
    name: config.email.from?.name || 'Stacks',
    address: config.email.from?.address || 'no-reply@stacksjs.com',
  }
}

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx === -1 ? p : p.slice(idx + 1)
}

async function materializeAttachments(atts: EmailAttachment[]): Promise<EmailAttachment[]> {
  return Promise.all(atts.map(async (att) => {
    if (typeof att.content === 'string' && att.content.startsWith('__file__:')) {
      const filePath = att.content.slice('__file__:'.length)
      const file = Bun.file(filePath)
      const buf = new Uint8Array(await file.arrayBuffer())
      return {
        ...att,
        content: buf,
        contentType: att.contentType || file.type || undefined,
        encoding: 'binary',
      }
    }
    return att
  }))
}
