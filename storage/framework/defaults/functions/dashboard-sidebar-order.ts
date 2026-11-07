import type { WebSidebarItem, WebSidebarSection } from '../resources/functions/dashboard/sidebar'
import { emptySidebarOrder, orderSidebarSections, parseSidebarOrder, sidebarGroupKey, type SidebarOrder } from '../resources/functions/dashboard/sidebar-order'
import { dashboardApi, DashboardApiError } from './dashboard-api'

interface OrderStatus { ready: boolean, saving: boolean, custom: boolean, message: string }
interface Target { kind: 'section' | 'item', id: string, group: string, element: HTMLElement, label: string }

/** Enhances the shared Sidebar's public DOM contract, without cloning its navigation or disclosure controller. */
export function createDashboardSidebarOrder(options: {
  pane: () => HTMLElement | null | undefined
  sections: WebSidebarSection[]
  status: (status: OrderStatus) => void
}) {
  let order = emptySidebarOrder()
  let acknowledged = order
  let ready = false
  let destroyed = false
  let pending = 0
  let revision = 0
  let scope = ''
  let writes = Promise.resolve()
  let detach = () => {}
  let message = 'Loading sidebar order…'
  const abort = new AbortController()
  const handles: HTMLButtonElement[] = []
  const targets = new Map<HTMLElement, Target>()
  const groups = new Map<string, string[]>()
  const custom = () => order.sections.length > 0 || Object.keys(order.items).length > 0
  function status() {
    if (destroyed) return
    options.status({ ready, saving: pending > 0, custom: custom(), message })
    for (const handle of handles) handle.disabled = !ready
  }

  function apply() {
    if (destroyed) return
    const pane = options.pane()
    if (!pane) return
    const sectionNodes = new Map([...pane.querySelectorAll<HTMLElement>('[data-sidebar-section]')].map(node => [node.dataset.sectionId!, node]))
    const sorted = orderSidebarSections(options.sections, order)
    groups.set('sections', sorted.map(section => section.id))
    function visit(items: WebSidebarItem[], section: string, ancestors: string[] = []) {
      groups.set(sidebarGroupKey(section, ancestors), items.map(item => item.id))
      const parent = sectionNodes.get(section)
      for (const item of items) {
        const row = [...(parent?.querySelectorAll<HTMLElement>('[data-sidebar-row]') ?? [])].find(node => node.dataset.itemId === item.id)
        if (row) row.parentElement!.append(row)
        if (item.children) visit(item.children, section, [...ancestors, item.id])
      }
    }
    for (const section of sorted) {
      const node = sectionNodes.get(section.id)
      if (node) node.parentElement!.append(node)
      visit(section.items, section.id)
    }
  }

  function save(next: SidebarOrder) {
    const mine = ++revision
    const writeScope = scope
    order = next
    pending++
    message = 'Saving sidebar order…'
    apply()
    status()
    // Mutations are serialized, so an older slow response cannot overwrite the final drop.
    writes = writes.then(async () => {
      try {
        const result = await dashboardApi<{ order: SidebarOrder }>('/api/dashboard/sidebar-order', { method: 'PUT', body: { order: next, scope: writeScope } })
        acknowledged = parseSidebarOrder(result.order)
        if (mine === revision) message = 'Order saved on this machine.'
      }
      catch (error) {
        if (error instanceof DashboardApiError && error.status === 409) ready = false
        if (mine === revision) { order = acknowledged; apply() }
        message = error instanceof Error ? error.message : 'Sidebar order could not be saved.'
      }
      finally { pending--; status() }
    })
  }

  function move(source: Target, target: Target, after: boolean) {
    if (!ready || source.kind !== target.kind || source.group !== target.group || source.id === target.id) return
    const current = groups.get(source.group) ?? []
    const next = current.filter(id => id !== source.id)
    const index = next.indexOf(target.id)
    if (index < 0 || !current.includes(source.id)) return
    next.splice(index + Number(after), 0, source.id)
    if (next.join('\0') === current.join('\0')) return
    save(source.kind === 'section'
      ? { ...order, sections: next }
      : { ...order, items: { ...order.items, [source.group]: next } })
    for (const [handle, target] of targets) {
      if (target === source) handle.focus({ preventScroll: true })
    }
  }

  function attach() {
    detach()
    const pane = options.pane()
    if (!pane || destroyed) return
    pane.setAttribute('data-dashboard-sidebar-order', '')
    const findRow = (section: HTMLElement, id: string) => [...section.querySelectorAll<HTMLElement>('[data-sidebar-row]')].find(row => row.dataset.itemId === id)
    function grip(target: Target) {
      const button = pane!.ownerDocument.createElement('button')
      button.type = 'button'
      button.className = 'dashboard-sidebar-order-grip'
      button.dataset.sidebarOrderHandle = target.kind
      button.setAttribute('aria-label', `Reorder ${target.label}`)
      button.title = 'Drag to reorder, or use the up and down arrow keys.'
      button.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Escape')
      const icon = pane!.ownerDocument.createElement('span')
      icon.className = 'i-hugeicons-drag-drop-vertical'
      icon.setAttribute('aria-hidden', 'true')
      button.append(icon)
      target.element.append(button)
      targets.set(button, target)
      handles.push(button)
    }
    for (const section of options.sections) {
      const node = [...pane.querySelectorAll<HTMLElement>('[data-sidebar-section]')].find(element => element.dataset.sectionId === section.id)
      if (!node) continue
      grip({ kind: 'section', id: section.id, group: 'sections', element: node, label: `${section.label || 'Home'} section` })
      function visit(items: WebSidebarItem[], ancestors: string[] = []) {
        for (const item of items) {
          const row = findRow(node!, item.id)
          if (row && items.length > 1) grip({ kind: 'item', id: item.id, group: sidebarGroupKey(section.id, ancestors), element: row, label: item.label })
          if (item.children) visit(item.children, [...ancestors, item.id])
        }
      }
      visit(section.items)
    }
    let drag: { source: Target, handle: HTMLElement, x: number, y: number, pointer: number, moved: boolean } | undefined
    let destination: { target: Target, after: boolean } | undefined
    let pointer: Pick<PointerEvent, 'clientX' | 'clientY'> | undefined
    let frame: number | undefined
    const view = pane.ownerDocument.defaultView
    function clear() {
      const previous = drag
      drag = undefined
      pointer = undefined
      if (frame !== undefined) view?.cancelAnimationFrame(frame)
      frame = undefined
      if (previous?.handle.hasPointerCapture(previous.pointer)) previous.handle.releasePointerCapture(previous.pointer)
      previous?.source.element.removeAttribute('data-order-dragging')
      destination?.target.element.removeAttribute('data-order-drop')
      destination = undefined
    }
    function targetAt(event: Pick<PointerEvent, 'clientX' | 'clientY'>): Target | undefined {
      const hit = pane!.ownerDocument.elementFromPoint(event.clientX, event.clientY)
      const element = hit?.closest<HTMLElement>(drag?.source.kind === 'section' ? '[data-sidebar-section]' : '[data-sidebar-row]')
      return [...targets.values()].find(target => target.element === element && target.kind === drag?.source.kind && target.group === drag.source.group)
    }
    function pointerdown(event: PointerEvent) {
      const handle = (event.target as Element).closest<HTMLElement>('[data-sidebar-order-handle]')
      const source = handle && targets.get(handle)
      if (!source || !ready || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      handle.focus({ preventScroll: true })
      handle.setPointerCapture(event.pointerId)
      drag = { source, handle, x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: false }
    }
    function pointermove(event: PointerEvent) {
      if (!drag || drag.pointer !== event.pointerId) return
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5 && !drag.moved) return
      drag.moved = true
      pointer = { clientX: event.clientX, clientY: event.clientY }
      drag.source.element.setAttribute('data-order-dragging', 'true')
      updateDestination()
      if (frame === undefined) frame = view?.requestAnimationFrame(scrollDrag)
    }
    function updateDestination() {
      destination?.target.element.removeAttribute('data-order-drop')
      destination = undefined
      if (!drag || !pointer) return
      const target = targetAt(pointer)
      if (!target || target.id === drag.source.id) return
      const rect = (target.kind === 'section' ? target.element.querySelector('[data-sidebar-section-header]') ?? target.element : target.element).getBoundingClientRect()
      const after = pointer.clientY >= rect.top + Math.min(rect.height, 40) / 2
      destination = { target, after }
      target.element.setAttribute('data-order-drop', after ? 'after' : 'before')
    }
    function scrollDrag() {
      frame = undefined
      if (!drag || !pointer || !view) return
      const scroll = pane!.querySelector<HTMLElement>('[data-sidebar-scroll]') ?? pane!
      const bounds = scroll.getBoundingClientRect()
      const inside = pointer.clientX >= bounds.left && pointer.clientX <= bounds.right && pointer.clientY >= bounds.top - 36 && pointer.clientY <= bounds.bottom + 36
      const amount = !inside ? 0 : pointer.clientY < bounds.top + 36 ? -24 : pointer.clientY > bounds.bottom - 36 ? 24 : 0
      if (amount) {
        const previous = scroll.scrollTop
        scroll.scrollBy({ top: amount, behavior: 'instant' })
        if (scroll.scrollTop !== previous) updateDestination()
      }
      if (drag) frame = view.requestAnimationFrame(scrollDrag)
    }
    function pointerup(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointer) return
      const source = drag.source
      const drop = drag.moved ? destination : undefined
      clear()
      if (drop) move(source, drop.target, drop.after)
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && drag) { clear(); event.preventDefault(); event.stopPropagation(); return }
      const target = targets.get(event.target as HTMLElement)
      if (!target || !ready || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const visible = [...targets.values()].filter(item => item.kind === target.kind && item.group === target.group && item.element.getBoundingClientRect().height > 0 && getComputedStyle(item.element).display !== 'none')
      const ids = (groups.get(target.group) ?? []).filter(id => visible.some(item => item.id === id))
      const next = ids[ids.indexOf(target.id) + (event.key === 'ArrowUp' ? -1 : 1)]
      const neighbor = visible.find(item => item.id === next)
      if (neighbor) move(target, neighbor, event.key === 'ArrowDown')
    }
    function click(event: MouseEvent) {
      if ((event.target as Element).closest('[data-sidebar-order-handle]')) { event.preventDefault(); event.stopPropagation() }
    }
    pane.addEventListener('pointerdown', pointerdown, true)
    pane.addEventListener('pointermove', pointermove, true)
    pane.addEventListener('pointerup', pointerup, true)
    pane.addEventListener('pointercancel', clear, true)
    pane.addEventListener('lostpointercapture', clear, true)
    pane.addEventListener('keydown', keydown, true)
    pane.addEventListener('click', click, true)
    detach = () => {
      clear()
      pane.removeEventListener('pointerdown', pointerdown, true)
      pane.removeEventListener('pointermove', pointermove, true)
      pane.removeEventListener('pointerup', pointerup, true)
      pane.removeEventListener('pointercancel', clear, true)
      pane.removeEventListener('lostpointercapture', clear, true)
      pane.removeEventListener('keydown', keydown, true)
      pane.removeEventListener('click', click, true)
      for (const handle of handles) handle.remove()
      handles.length = 0
      targets.clear()
      pane.removeAttribute('data-dashboard-sidebar-order')
    }
    apply()
    status()
  }

  async function load() {
    ready = false
    status()
    try {
      const result = await dashboardApi<{ order: SidebarOrder, scope: string, warning?: string }>('/api/dashboard/sidebar-order', { signal: abort.signal })
      if (destroyed) return
      order = acknowledged = parseSidebarOrder(result.order)
      scope = result.scope
      ready = true
      message = result.warning || 'Drag grips to reorder. Arrow keys also work.'
      apply()
    }
    catch (error) { if (!destroyed) message = error instanceof Error ? error.message : 'Sidebar order could not be loaded.' }
    status()
  }

  return {
    attach,
    load,
    reset() { if (ready) save(emptySidebarOrder()) },
    destroy() { destroyed = true; abort.abort(); detach() },
  }
}
