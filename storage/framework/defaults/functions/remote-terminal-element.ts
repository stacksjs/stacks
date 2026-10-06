// The stylesheet's text-import declaration travels with this module, so an app
// typechecking it gets the declaration whatever its tsconfig includes.
/// <reference path="./xterm-styles.d.ts" />
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'
import { DashboardApiError } from './dashboard-api'
import { closeTerminalSession, openTerminalSession, resizeTerminalSession, sendTerminalInput, streamTerminal } from './remote'

/**
 * `<stacks-remote-terminal host="app">` - an interactive terminal session on a
 * configured host, rendered with xterm.js (stacksjs/stacks#960).
 *
 * The session opens when the element is attached and closes when it is
 * removed, so leaving the page ends the remote shell instead of leaving it
 * running for the server's detach grace. Output arrives as server-sent events
 * read through `fetch`; keystrokes go out as small POSTs, batched and sent one
 * at a time so they arrive in the order they were typed.
 *
 * Fires `terminal-open` with `{ id }` and `terminal-exit` with
 * `{ reason, exitCode, message }`.
 *
 * Everything browser-only - xterm, its stylesheet, the `HTMLElement` subclass -
 * is loaded inside {@link registerRemoteTerminal}. This module is also loaded
 * on the server, by the auto-import barrel for this directory: a class
 * extending `HTMLElement` at the top level threw there and took every function
 * in the barrel down with it, and xterm left a handle open that would keep a
 * CLI process from exiting.
 */

const STYLE_ID = 'stacks-xterm-styles'
const MAX_RECONNECTS = 5

interface Xterm {
  Terminal: typeof Terminal
  FitAddon: typeof FitAddon
  styles: string
}

function ensureStyles(styles: string): void {
  if (document.getElementById(STYLE_ID))
    return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = styles
  document.head.append(style)
}

function defineElement(xterm: Xterm) {
  return class StacksRemoteTerminal extends HTMLElement {
    static observedAttributes = ['host']

    /**
     * Bumped by every start and teardown. Opening a session is asynchronous,
     * and the element can be detached, re-attached or pointed at another host
     * meanwhile; a continuation from an older lifetime sees the number has
     * moved on and closes what it opened instead of adopting it.
     */
    private generation = 0
    private running?: string
    private terminal?: Terminal
    private fit?: FitAddon
    private session?: string
    private abort = new AbortController()
    private observer?: ResizeObserver
    private seq = 0
    private pending = ''
    private sending = false
    private ended = false
    private resizeTimer?: ReturnType<typeof setTimeout>

    connectedCallback(): void {
      void this.start()
    }

    /**
     * A template may set `host` after inserting the element, so this starts it
     * too; and a different host on a running element is a new session there.
     */
    attributeChangedCallback(_name: string, previous: string | null, next: string | null): void {
      if (this.running !== undefined && previous !== next)
        this.teardown()
      void this.start()
    }

    /**
     * A template may detach an element and attach it again - stx's `:if` keeps
     * the hidden nodes and re-inserts the same ones. So a removal is acted on
     * a tick later, and only if the element is still out of the document; and
     * once torn down, the next attach starts a fresh session.
     */
    disconnectedCallback(): void {
      setTimeout(() => {
        if (!this.isConnected)
          this.teardown()
      }, 0)
    }

    private async start(): Promise<void> {
      const host = this.getAttribute('host')
      if (this.running !== undefined || !this.isConnected || !host)
        return
      this.running = host
      const generation = ++this.generation
      this.abort = new AbortController()
      this.seq = 0
      this.pending = ''
      this.sending = false
      this.ended = false
      this.session = undefined
      ensureStyles(xterm.styles)

      const surface = document.createElement('div')
      surface.style.width = '100%'
      surface.style.height = '100%'
      this.replaceChildren(surface)

      const terminal = new xterm.Terminal({
        cursorBlink: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 13,
        scrollback: 5000,
        theme: { background: '#0a0a0a' },
      })
      const fit = new xterm.FitAddon()
      terminal.loadAddon(fit)
      terminal.open(surface)
      fit.fit()
      this.terminal = terminal
      this.fit = fit

      let id: string
      try {
        id = (await openTerminalSession(host, terminal.cols, terminal.rows)).id
      }
      catch (error) {
        if (generation === this.generation)
          this.finish('refused', null, error instanceof Error ? error.message : String(error))
        return
      }

      // Torn down or re-hosted while the session was opening: close it rather
      // than leave a shell nobody is attached to.
      if (generation !== this.generation) {
        void closeTerminalSession(id).catch(() => {})
        return
      }
      this.session = id

      terminal.onData(data => this.type(data))
      terminal.onResize(({ cols, rows }) => {
        clearTimeout(this.resizeTimer)
        this.resizeTimer = setTimeout(() => {
          if (this.session && !this.ended)
            void resizeTerminalSession(this.session, cols, rows).catch(() => {})
        }, 150)
      })
      this.observer = new ResizeObserver(() => this.fit?.fit())
      this.observer.observe(this)

      this.dispatchEvent(new CustomEvent('terminal-open', { detail: { id } }))
      terminal.focus()
      void this.pump()
    }

    private teardown(): void {
      this.generation++
      this.abort.abort()
      this.observer?.disconnect()
      this.observer = undefined
      clearTimeout(this.resizeTimer)
      if (this.session && !this.ended)
        void closeTerminalSession(this.session).catch(() => {})
      this.session = undefined
      this.ended = true
      this.terminal?.dispose()
      this.terminal = undefined
      this.fit = undefined
      this.running = undefined
      this.replaceChildren()
    }

    /**
     * Read output until the session ends, reconnecting from the last sequence
     * seen. Bound to the lifetime that started it: a restart gives the next
     * session its own pump, and this one stops.
     */
    private async pump(): Promise<void> {
      const generation = this.generation
      const { signal } = this.abort
      const session = this.session!
      const current = () => generation === this.generation && !this.ended
      let failures = 0
      while (current()) {
        try {
          for await (const event of streamTerminal(session, this.seq, signal)) {
            failures = 0
            if (event.type === 'output') {
              this.seq = event.seq
              this.terminal?.write(event.data)
            }
            else {
              this.finish(event.reason, event.exitCode)
              return
            }
          }
        }
        catch (error) {
          if (signal.aborted || !current())
            return
          if (error instanceof DashboardApiError && error.status === 404) {
            this.finish('ended', null)
            return
          }
        }

        if (!current())
          return
        if (++failures > MAX_RECONNECTS) {
          this.finish('disconnected', null, 'The connection to the server was lost.')
          return
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(500 * 2 ** failures, 8000)))
      }
    }

    /** Batch keystrokes, one request in flight at a time, so they arrive in order. */
    private type(data: string): void {
      if (this.ended || !this.session)
        return
      this.pending += data
      if (!this.sending)
        void this.flush()
    }

    private async flush(): Promise<void> {
      const generation = this.generation
      const session = this.session!
      this.sending = true
      try {
        while (this.pending && !this.ended && generation === this.generation) {
          const data = this.pending
          this.pending = ''
          try {
            await sendTerminalInput(session, data)
          }
          catch (error) {
            if (error instanceof DashboardApiError && error.status === 404 && generation === this.generation)
              this.finish('ended', null)
          }
        }
      }
      finally {
        if (generation === this.generation)
          this.sending = false
      }
    }

    private finish(reason: string, exitCode: number | null, message?: string): void {
      if (this.ended)
        return
      this.ended = true
      this.abort.abort()
      const note = message ?? (exitCode === null ? `session ${reason}` : `session ${reason}, exit ${exitCode}`)
      this.terminal?.write(`\r\n\x1B[2m[${note}]\x1B[0m\r\n`)
      this.dispatchEvent(new CustomEvent('terminal-exit', { detail: { reason, exitCode, message } }))
    }
  }
}

let registering: Promise<void> | undefined

/**
 * Load xterm and define the element, once. Safe to call from every component
 * that uses it, and a no-op outside a browser. Elements already in the page
 * upgrade when the definition lands.
 */
export function registerRemoteTerminal(): Promise<void> {
  if (typeof customElements === 'undefined')
    return Promise.resolve()
  registering ??= (async () => {
    const [{ Terminal }, { FitAddon }, styles] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/xterm/css/xterm.css', { with: { type: 'text' } }).then(module => module.default as string),
    ])
    if (!customElements.get('stacks-remote-terminal'))
      customElements.define('stacks-remote-terminal', defineElement({ Terminal, FitAddon, styles }))
  })()
  return registering
}
