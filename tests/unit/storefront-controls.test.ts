import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx/process'
import { defaultConfig } from '@stacksjs/stx/config'
import { click, findChrome, launch, navigate, settle } from '@stacksjs/testing/browser'

const componentsDir = resolve(import.meta.dir, '../../storage/framework/defaults/resources/components/Storefront')

test('basket summaries distinguish an item subtotal from a quoted final total without changing default labels', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-order-summary-'))
  try {
    const options = { ...defaultConfig, root, componentsDir, cache: false }
    const custom = await processDirectives('<OrderSummary heading="Your basket" totalTitle="Items total" subtotalLabel="$399.00" shippingLabel="At checkout" totalLabel="$399.00" taxLabel="At checkout" />', {}, join(root, 'Custom.stx'), options, new Set())
    expect(custom).toContain('Your basket')
    expect(custom).toContain('Items total')
    expect(custom).toContain('>Tax</dt>')
    const standard = await processDirectives('<OrderSummary subtotalLabel="$20.00" shippingLabel="$5.00" totalLabel="$25.00" />', {}, join(root, 'Standard.stx'), options, new Set())
    expect(standard).toContain('Order summary')
    expect(standard).toContain('>Total</p>')
    expect(standard).not.toContain('>Tax</dt>')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('product cards render generic descriptions and transparent pricing without image overlays', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-product-card-'))
  try {
    const html = await processDirectives('<ProductCard slug="chair" name="Chair" priceLabel="$224.50" image="/chair.png" href="/shop?size=M" description="Repairable mobility" ingredient="Legacy food" priceNote="Target price" imageAlt="Concept chair" badge="In development" />', {}, join(root, 'Page.stx'), { ...defaultConfig, root, componentsDir, cache: false }, new Set())
    expect(html).toContain('href="/shop?size=M"')
    expect(html).toContain('Repairable mobility')
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '')
    expect(visible).not.toContain('Legacy food')
    expect(html).toContain('Target price')
    expect(html).toContain('alt="Concept chair"')
    expect(html).not.toContain('absolute left-3 top-3')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test.skipIf(!findChrome())('quantity selectors keep independent state, respect bounds and submit their current whole quantity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-quantity-'))
  let server: ReturnType<typeof Bun.serve> | undefined
  let browser: Awaited<ReturnType<typeof launch>> | undefined
  try {
    const source = '<!doctype html><html><body><script client>const changes = state(0); const limit = state(5); const amount = state(4)</script><form id="first"><QuantitySelector :value="2" :min="1" :max="3" @change="changes.update(count => count + 1)" /></form><output id="changes">{{ changes() }}</output><form id="second"><QuantitySelector :value="4" :min="0" :max="5" /></form><form id="dynamic"><QuantitySelector v-model:value="amount" :min="1" :max="limit()" /></form><button id="shrink" @click="limit.set(2)">Shrink maximum</button><button id="external" @click="amount.set(9)">Set external quantity</button><output id="amount">{{ amount() }}</output></body></html>'
    const html = await processDirectives(source, {}, join(root, 'Page.stx'), { ...defaultConfig, root, componentsDir, cache: false }, new Set())
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) })
    browser = await launch()
    const { cdp } = browser
    await navigate(cdp, `http://127.0.0.1:${server.port}/`)
    await settle(cdp)
    await cdp.evaluate("(() => { window.formChanges = 0; document.querySelector('#first').addEventListener('change', () => window.formChanges++); })()")
    await click(cdp, '#first [data-stx-qty-inc]')
    await settle(cdp)
    expect(await cdp.evaluate("new FormData(document.querySelector('#first')).get('quantity')")).toBe('3')
    expect(await cdp.evaluate("document.querySelector('#changes').textContent.trim()")).toBe('1')
    expect(await cdp.evaluate('window.formChanges')).toBe(1)
    expect(await cdp.evaluate("document.querySelector('#first [data-stx-qty-inc]').disabled")).toBe(true)
    expect(await cdp.evaluate("new FormData(document.querySelector('#second')).get('quantity')")).toBe('4')
    await click(cdp, '#second [data-stx-qty-dec]')
    await settle(cdp)
    expect(await cdp.evaluate("new FormData(document.querySelector('#second')).get('quantity')")).toBe('3')
    await cdp.evaluate("(() => { const input = document.querySelector('#second input'); input.value = '2.5'; input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); })()")
    await settle(cdp)
    expect(await cdp.evaluate("new FormData(document.querySelector('#second')).get('quantity')")).toBe('0')
    await click(cdp, '#shrink')
    await settle(cdp)
    expect(await cdp.evaluate("document.querySelector('#dynamic input').max")).toBe('2')
    expect(await cdp.evaluate("new FormData(document.querySelector('#dynamic')).get('quantity')")).toBe('2')
    await click(cdp, '#external')
    await settle(cdp)
    expect(await cdp.evaluate("new FormData(document.querySelector('#dynamic')).get('quantity')")).toBe('2')
    expect(await cdp.evaluate("document.querySelector('#amount').textContent.trim()")).toBe('2')
    expect(cdp.errors).toEqual([])
  }
  finally {
    await browser?.close()
    server?.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
