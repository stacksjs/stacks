/**
 * The STX router replaces the rendered fragment on a same-page refresh. Keep
 * edits on the client side of that boundary while the new server HTML mounts.
 * The generated script runs only on Buddy's managed development frontend.
 */
function installPageStateRetention(): void {
  type Scope = Record<string, unknown>
  type ScopeElement = HTMLElement & { __stx_page_scope?: Scope }
  type Signal = (() => unknown) & { _isSignal: true, set: (value: unknown) => void }
  type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  type Locator = (root: Element) => HTMLElement | undefined

  const stxWindow = window as Window & {
    stx?: { _scopes?: Record<string, Scope>, _flushLoad?: () => boolean }
    __stxRouterConfig?: { container?: string }
    __stacksRetainsPageState?: boolean
  }
  if (stxWindow.__stacksRetainsPageState)
    return
  stxWindow.__stacksRetainsPageState = true
  const signalDefaults = new WeakMap<Signal, unknown>()
  const controlDefaults = new WeakMap<Control, string>()
  const controls = 'input:not([type=file]), textarea, select'
  let restore: ((root: HTMLElement) => void) | undefined

  function page(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-stx-content]')
      ?? document.querySelector<HTMLElement>(stxWindow.__stxRouterConfig?.container || 'main')
      ?? document.querySelector<HTMLElement>('#main-content')
      ?? document.body
  }

  function locate(element: HTMLElement, root: HTMLElement): Locator {
    const steps: number[] = []
    for (let node: Element = element; node !== root && node.parentElement; node = node.parentElement)
      steps.unshift(Array.from(node.parentElement.children).indexOf(node))
    const { id, localName } = element
    const name = element.getAttribute('name')
    const type = element.getAttribute('type')
    return (newRoot) => {
      let candidate: Element | null | undefined = id ? document.getElementById(id) : newRoot
      if (!id) {
        for (const step of steps)
          candidate = candidate?.children[step]
      }
      if (candidate instanceof HTMLElement && newRoot.contains(candidate) && candidate.localName === localName
        && candidate.getAttribute('name') === name && candidate.getAttribute('type') === type)
        return candidate
    }
  }

  function scopes(root: HTMLElement): Array<{ target: Locator, scope: (node: HTMLElement) => Scope | undefined }> {
    const entries: Array<{ target: Locator, scope: (node: HTMLElement) => Scope | undefined }> = [{
      target: node => node as HTMLElement,
      scope: (node: HTMLElement) => (node as ScopeElement).__stx_page_scope ?? (document.body as ScopeElement).__stx_page_scope,
    }]
    for (const element of root.querySelectorAll<HTMLElement>('[data-stx-scope]')) {
      entries.push({
        target: locate(element, root),
        scope: node => stxWindow.stx?._scopes?.[node.getAttribute('data-stx-scope') ?? ''],
      })
    }
    return entries
  }

  function signals(scope: Scope | undefined): Array<[string, Signal]> {
    return Object.entries(scope ?? {}).filter((entry): entry is [string, Signal] => {
      const value = entry[1]
      return typeof value === 'function' && (value as Signal)._isSignal === true && typeof (value as Signal).set === 'function'
    })
  }

  function fieldValue(element: Control): string {
    if (element instanceof HTMLSelectElement)
      return JSON.stringify(Array.from(element.selectedOptions, option => option.value))
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio'))
      return String(element.checked)
    return element.value
  }

  function setFieldValue(element: Control, value: string): void {
    if (element instanceof HTMLSelectElement) {
      const selected = new Set<string>(JSON.parse(value))
      for (const option of element.options)
        option.selected = selected.has(option.value)
    }
    else if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      element.checked = value === 'true'
    }
    else {
      element.value = value
    }
  }

  function remember(root: HTMLElement): void {
    for (const { target, scope } of scopes(root)) {
      const node = target(root)
      for (const [, value] of signals(node && scope(node))) {
        if (!signalDefaults.has(value))
          signalDefaults.set(value, value())
      }
    }
    for (const field of root.querySelectorAll<Control>(controls)) {
      if (!controlDefaults.has(field))
        controlDefaults.set(field, fieldValue(field))
    }
  }

  function snapshot(root: HTMLElement): (root: HTMLElement) => void {
    const pageState = scopes(root).map(({ target, scope }) => {
      const node = target(root)
      const current = signals(node && scope(node))
      return { target, scope, current }
    })
    const fields = Array.from(root.querySelectorAll<Control>(controls), field => ({ target: locate(field, root), field }))
    const scrolling = [root, ...root.querySelectorAll<HTMLElement>('*')]
      .filter(element => element.scrollLeft || element.scrollTop)
      .map(element => ({ target: locate(element, root), left: element.scrollLeft, top: element.scrollTop }))
    const viewport = { left: window.scrollX, top: window.scrollY }
    const active = document.activeElement
    const focus = active instanceof HTMLElement && root.contains(active) ? locate(active, root) : undefined
    const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection }
      : undefined
    return (replacement) => {
      for (const { target, scope, current } of pageState) {
        const node = target(replacement)
        const next = new Map(signals(node && scope(node)))
        for (const [key, signal] of current) {
          const fresh = next.get(key)
          const value = signal()
          if (fresh && fresh !== signal && (!signalDefaults.has(signal) || !Object.is(signalDefaults.get(signal), value)))
            fresh.set(value)
        }
      }
      for (const { target, field } of fields) {
        const node = target(replacement) as Control | undefined
        const value = fieldValue(field)
        if (node && node !== field && (!controlDefaults.has(field) || controlDefaults.get(field) !== value))
          setFieldValue(node, value)
      }
      const focused = focus?.(replacement)
      if (focused) {
        focused.focus({ preventScroll: true })
        if ((focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)
          && selection && selection.start !== null && selection.end !== null)
          focused.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined)
      }
      for (const { target, left, top } of scrolling) {
        const node = target(replacement)
        if (node) {
          node.scrollLeft = left
          node.scrollTop = top
        }
      }
      window.scrollTo(viewport.left, viewport.top)
    }
  }

  window.addEventListener('stx:before-navigate', (event) => {
    const url = (event as CustomEvent<{ url: string }>).detail?.url
    restore = url && new URL(url, location.href).href === location.href ? snapshot(page()) : undefined
  })
  window.addEventListener('stx:load', () => queueMicrotask(() => {
    const pending = restore
    restore = undefined
    // The signals handler normally debounces hydration after stx:load.
    stxWindow.stx?._flushLoad?.()
    const root = page()
    remember(root)
    pending?.(root)
  }))
  document.addEventListener('DOMContentLoaded', () => queueMicrotask(() => remember(page())), { once: true })
}

const stateScript = '<script data-stacks-dev-page-state>(' + installPageStateRetention.toString() + ')()</script>'

export function retainFrontendPageState(response: Response): Response | undefined {
  if (!response.body || response.headers.has('content-encoding') || response.headers.get('x-stx-fragment') === 'true'
    || !response.headers.get('content-type')?.startsWith('text/html'))
    return
  const rewritten = new HTMLRewriter().on('script[data-stx-hmr]', {
    element(script) { script.before(stateScript, { html: true }) },
  }).transform(response)
  rewritten.headers.delete('content-length')
  return rewritten
}
