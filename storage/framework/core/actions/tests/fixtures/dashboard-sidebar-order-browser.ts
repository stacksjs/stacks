import { expect } from 'bun:test'
import { click, launch, navigate, waitFor } from '../../../testing/src/browser'

export async function verifySidebarOrdering(origin: string): Promise<void> {
  const browser = await launch({ viewport: { width: 1280, height: 900 } })
  const { cdp } = browser
  const pane = '[data-stx-sidebar]'
  const item = (id: string) => `${pane} [data-item-id="${id}"] > [data-sidebar-order-handle="item"]`
  const section = (id: string) => `${pane} [data-section-id="${id}"] > [data-sidebar-order-handle="section"]`
  const order = () => cdp.evaluate<string[]>(`[...document.querySelectorAll('${pane} [data-section-id="app-nav-0"] [data-sidebar-row]')].map(row => row.dataset.itemId)`)
  const saved = () => fetch(`${origin}/api/dashboard/sidebar-order`).then(response => response.json())
  let edgeDiagnostics: unknown
  try {
    await navigate(cdp, `${origin}/order-test`)
    await waitFor(() => cdp.evaluate(`Boolean(document.querySelector('${item('alpha')}:not(:disabled)'))`), 15_000, { label: 'hydrated drag grips' })
    expect(await cdp.evaluate(`getComputedStyle(document.querySelector('${item('alpha')} span')).maskImage`)).not.toBe('none')
    await click(cdp, { selector: '[data-sidebar-order-controls] button', text: 'Reset order' })
    await waitFor(() => cdp.evaluate(`document.querySelector('[data-sidebar-order-controls] [role="status"]')?.textContent.includes('saved')`))
    expect(await order()).toEqual(['alpha', 'beta', 'gamma'])
    await click(cdp, item('alpha'))
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await waitFor(async () => (await saved()).order.items['["app-nav-0"]']?.[0] === 'beta')
    expect(await order()).toEqual(['beta', 'alpha', 'gamma'])
    expect(await cdp.evaluate('location.pathname')).toBe('/order-test')
    expect(await cdp.evaluate(`document.activeElement?.getAttribute('aria-label')`)).toBe('Reorder Alpha')

    // Native pointer input, rather than a dispatched drop event, qualifies dragging.
    const points = await cdp.evaluate<any>(`(() => {
      const from = document.querySelector('${item('gamma')}'); from.scrollIntoView({ block: 'center' });
      const to = document.querySelector('${item('beta')}');
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      return { from: { x: a.x + a.width / 2, y: a.y + a.height / 2 }, to: { x: b.x + b.width / 2, y: b.y + 2 } };
    })()`)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...points.from, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...points.to, button: 'left', buttons: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.to, button: 'left', clickCount: 1 })
    await waitFor(async () => (await saved()).order.items['["app-nav-0"]']?.[0] === 'gamma')
    expect(await order()).toEqual(['gamma', 'beta', 'alpha'])

    // Moving a section uses the same pointer contract and carries all its descendants.
    const sectionPoints = await cdp.evaluate<any>(`(() => {
      const from = document.querySelector('${section('app-nav-0')}'), to = document.querySelector('${section('top')}');
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      return { from: { x: a.x + a.width / 2, y: a.y + a.height / 2 }, to: { x: b.x + b.width / 2, y: b.y + 1 } };
    })()`)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...sectionPoints.from, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...sectionPoints.to, button: 'left', buttons: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...sectionPoints.to, button: 'left', clickCount: 1 })
    await waitFor(async () => (await saved()).order.sections[0] === 'app-nav-0')

    await click(cdp, section('app-nav-0'))
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await waitFor(async () => (await saved()).order.sections[0] === 'top')
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', windowsVirtualKeyCode: 38 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 })
    await waitFor(async () => (await saved()).order.sections[0] === 'app-nav-0')
    await navigate(cdp, `${origin}/order-test`)
    await waitFor(async () => (await order())[0] === 'gamma')
    expect(await cdp.evaluate(`document.querySelector('${pane} [data-sidebar-section]')?.getAttribute('data-section-id')`)).toBe('app-nav-0')

    const fresh = await launch({ viewport: { width: 1280, height: 900 } })
    try {
      await navigate(fresh.cdp, `${origin}/order-test`)
      await waitFor(() => fresh.cdp.evaluate(`document.querySelector('${pane} [data-section-id="app-nav-0"] [data-sidebar-row]')?.getAttribute('data-item-id') === 'gamma'`))
    }
    finally { await fresh.close() }

    const moreId = await cdp.evaluate<string>(`[...document.querySelectorAll('${pane} [data-sidebar-row]')].find(row => row.textContent.includes('More models'))?.dataset.itemId`)
    const moreSelector = `${pane} [data-item-id="${moreId}"]`
    await click(cdp, `${moreSelector} [data-sidebar-disclosure]`)
    const nested = await cdp.evaluate<string[]>(`[...document.querySelectorAll('${pane} [data-parents="${moreId}"]')].map(row => row.dataset.itemId)`)
    expect(nested.length).toBeGreaterThanOrEqual(2)
    await click(cdp, item(nested[0]!))
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await waitFor(async () => (await saved()).order.items[JSON.stringify(['data', moreId])]?.[0] === nested[1])
    expect(await cdp.evaluate(`document.querySelector('${pane} [data-item-id="${nested[0]}"]')?.getAttribute('data-parents')`)).toBe(moreId)
    // A tall section must scroll past its own descendants while a drag is
    // held at the viewport edge, including when the pointer stays still.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 320, deviceScaleFactor: 1, mobile: false })
    const edge = await cdp.evaluate<any>(`(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const handle = document.querySelector('${section('data')}'); handle.scrollIntoView({ block: 'center' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const scroll = document.querySelector('${pane} [data-sidebar-scroll]');
      const a = handle.getBoundingClientRect(), b = scroll.getBoundingClientRect();
      const x = a.x + a.width / 2, y = b.bottom - 8;
      return { from: { x, y: a.y + a.height / 2 }, to: { x, y }, before: scroll.scrollTop, remaining: scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop, target: document.elementFromPoint(x, y)?.closest('[data-sidebar-section]')?.dataset.sectionId };
    })()`)
    edgeDiagnostics = edge
    expect(edge.target).toBe('data')
    expect(edge.remaining).toBeGreaterThan(48)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...edge.from, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...edge.to, button: 'left', buttons: 1 })
    await waitFor(() => cdp.evaluate(`document.querySelector('${pane} [data-sidebar-scroll]').scrollTop > ${edge.before + 48}`), 2000, { label: 'continuous drag edge scrolling' })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...edge.to, button: 'left', clickCount: 1 })
    const stoppedAt = await cdp.evaluate<number>(`document.querySelector('${pane} [data-sidebar-scroll]').scrollTop`)
    await Bun.sleep(80)
    expect(await cdp.evaluate(`document.querySelector('${pane} [data-sidebar-scroll]').scrollTop`)).toBe(stoppedAt)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
    await click(cdp, `${moreSelector} [data-sidebar-disclosure]`)
    expect(await cdp.evaluate(`document.querySelector('${pane} [data-item-id="${nested[0]}"]')?.hasAttribute('data-collapsed')`)).toBe(true)

    // A rejected save restores the acknowledged order and tells the operator.
    const remove = await cdp.intercept([{ urlPattern: '*/api/dashboard/sidebar-order' }], async (request, session) => {
      if (request.request.method === 'PUT') await session.send('Fetch.fulfillRequest', { requestId: request.requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: btoa('{"message":"Disk unavailable"}') })
      else await session.send('Fetch.continueRequest', { requestId: request.requestId })
    })
    await click(cdp, item('gamma'))
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', windowsVirtualKeyCode: 40 })
    await waitFor(() => cdp.evaluate(`document.querySelector('[data-sidebar-order-controls] [role="status"]')?.textContent.includes('Disk unavailable')`))
    expect(await order()).toEqual(['gamma', 'beta', 'alpha'])
    await remove()
    await click(cdp, { selector: '[data-sidebar-order-controls] button', text: 'Reset order' })
    await waitFor(async () => Object.keys((await saved()).order.items).length === 0)
    expect(await order()).toEqual(['alpha', 'beta', 'gamma'])
    expect(cdp.errors.filter(error => !error.includes('503') && !error.includes('Disk unavailable'))).toEqual([])
  }
  catch (error) {
    console.error('Sidebar browser diagnostics:', JSON.stringify({ errors: cdp.errors, edge: edgeDiagnostics, scroll: await cdp.evaluate(`(() => { const node = document.querySelector('${pane} [data-sidebar-scroll]'); const b = node.getBoundingClientRect(); return { top: node.scrollTop, height: node.clientHeight, rect: { left: b.left, right: b.right, top: b.top, bottom: b.bottom }, dragging: document.querySelector('[data-order-dragging]')?.getAttribute('data-section-id') }; })()`), page: await cdp.evaluate('document.body.innerText.slice(0,2000)'), handles: await cdp.evaluate('[...document.querySelectorAll("[data-sidebar-order-handle]")].slice(0,5).map(node => node.outerHTML)') }))
    throw error
  }
  finally { await browser.close() }
}
