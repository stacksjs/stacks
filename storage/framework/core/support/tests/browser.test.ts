import { expect, test } from 'bun:test'
import { createSupportBrowser } from '../src/browser'

test('boots a registered widget without DOM globals and clears identity before reboot', async () => {
  const calls: unknown[] = []
  const browser = createSupportBrowser({
    boot: async config => { calls.push(['boot', config]) },
    open: () => calls.push('open'), close: () => calls.push('close'),
    update: async config => { calls.push(['update', config]) },
    track: async (event, attributes) => { calls.push(['track', event, attributes]) },
    shutdown: () => calls.push('shutdown'),
  })
  await browser.boot({ project: 'p', sessionToken: 'customer-a' })
  browser.open()
  await browser.track('order.viewed', { id: 'order-1' })
  await browser.boot({ project: 'p', sessionToken: 'customer-b' })
  expect(calls).toEqual([
    ['boot', { url: 'https://hq.support', project: 'p', token: 'customer-a', locale: undefined }],
    'open', ['track', 'order.viewed', { id: 'order-1' }], 'shutdown',
    ['boot', { url: 'https://hq.support', project: 'p', token: 'customer-b', locale: undefined }],
  ])
  browser.shutdown()
  browser.shutdown()
  expect(calls.filter(call => call === 'shutdown')).toHaveLength(2)
  expect(() => browser.open()).toThrow('not booted')
})

test('does not reopen a widget whose pending boot was shut down', async () => {
  let finish: () => void = () => {}
  let shutdowns = 0
  const browser = createSupportBrowser({ boot: () => new Promise<void>(resolve => { finish = resolve }), open() {}, close() {}, update() {}, track: async () => {}, shutdown() { shutdowns++ } })
  const pending = browser.boot({ project: 'p' })
  browser.shutdown()
  finish()
  await pending
  expect(shutdowns).toBeGreaterThanOrEqual(1)
  expect(() => browser.open()).toThrow('not booted')
})
