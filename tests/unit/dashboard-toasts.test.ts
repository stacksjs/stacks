import { afterEach, expect, test } from 'bun:test'

const toastModuleUrl = new URL(
  '../../storage/framework/defaults/functions/toasts.ts',
  import.meta.url,
).href

afterEach(() => {
  delete (globalThis as typeof globalThis & {
    __stacksDashboardToastStore?: unknown
  }).__stacksDashboardToastStore
})

test('shares toast state between independently loaded client bundles', async () => {
  const firstBundle = await import(`${toastModuleUrl}?bundle=first`)
  const secondBundle = await import(`${toastModuleUrl}?bundle=second`)

  firstBundle.clearAllToasts()
  const id = firstBundle.pushToast('error', 'Shared failure', {
    detail: 'Visible from the layout bundle',
    durationMs: 0,
  })

  expect(secondBundle.useToasts().toasts()).toEqual([
    expect.objectContaining({
      id,
      type: 'error',
      title: 'Shared failure',
      detail: 'Visible from the layout bundle',
    }),
  ])

  secondBundle.dismissToast(id)
  expect(firstBundle.useToasts().toasts()).toEqual([])
})
