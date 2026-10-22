import { expect, test } from 'bun:test'
import { runInNewContext } from 'node:vm'
import { parseScenarioStep, runScenarioStep } from '../../../defaults/ai/skills/stacks-browse/scripts/browse'

function page(delayMs: number) {
  const started = performance.now()
  const element = {
    tagName: 'BUTTON',
    get innerText() { return performance.now() - started >= delayMs ? 'Sound on' : 'Sound off' },
    getBoundingClientRect: () => ({ width: 100, height: 30 }),
  }
  let probes = 0
  return {
    probes: () => probes,
    send: async (method: string, params: Record<string, unknown> = {}) => {
      expect(method).toBe('Runtime.evaluate')
      probes++
      const value = runInNewContext(String(params.expression), {
        document: { querySelectorAll: () => [element] },
        getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
      })
      return { result: { value } }
    },
  }
}

test('bounded assertions observe asynchronous visible state instead of a fixed sleep', async () => {
  const browser = page(80)
  const step = parseScenarioStep(JSON.stringify({ action: 'assert', selector: 'button', text: 'Sound on', timeoutMs: 1000 }))
  expect(await runScenarioStep(browser, step)).toMatchObject({ ok: true, text: 'Sound on' })
  expect(browser.probes()).toBeGreaterThan(1)
})

test('bounded assertions retain failure when the visible result never arrives', async () => {
  const browser = page(Infinity)
  const step = parseScenarioStep(JSON.stringify({ action: 'assert', selector: 'button', text: 'Sound on', timeoutMs: 80 }))
  await expect(runScenarioStep(browser, step)).rejects.toThrow('Scenario assert failed: Element not found (button)')
  expect(browser.probes()).toBeGreaterThan(1)
})

test('ordinary assertions remain immediate and protocol errors are not retried', async () => {
  const browser = page(Infinity)
  await expect(runScenarioStep(browser, parseScenarioStep('{"action":"assert","selector":"button","text":"Sound on"}'))).rejects.toThrow('Element not found')
  expect(browser.probes()).toBe(1)
  let calls = 0
  const broken = { send: async () => { calls++; throw new Error('CDP connection closed') } }
  await expect(runScenarioStep(broken, parseScenarioStep('{"action":"assert","selector":"button","timeoutMs":1000}'))).rejects.toThrow('CDP connection closed')
  expect(calls).toBe(1)
})

test('readiness budgets are bounded and apply only to assertions', () => {
  for (const timeoutMs of [-1, 0.5, 30001, '1000']) {
    expect(() => parseScenarioStep(JSON.stringify({ action: 'assert', selector: 'button', timeoutMs }))).toThrow('timeoutMs')
  }
  expect(() => parseScenarioStep('{"action":"click","selector":"button","timeoutMs":1000}')).toThrow('timeoutMs')
})

test('the assertion deadline also bounds a stalled browser response', async () => {
  const stalled = { send: async () => await new Promise<never>(() => {}) }
  await expect(runScenarioStep(stalled, parseScenarioStep('{"action":"assert","selector":"button","timeoutMs":40}'))).rejects.toThrow('timed out after 40ms')
})

test('a successful response after the deadline cannot pass the assertion', async () => {
  const late = { send: async () => {
    const until = performance.now() + 50
    while (performance.now() < until) { /* An occupied event loop delays timers too. */ }
    return { result: { value: { ok: true } } }
  } }
  await expect(runScenarioStep(late, parseScenarioStep('{"action":"assert","selector":"button","timeoutMs":20}'))).rejects.toThrow('timed out after 20ms')
})
