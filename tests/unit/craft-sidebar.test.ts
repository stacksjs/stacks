import { afterEach, describe, expect, test } from 'bun:test'
import {
  type CraftSidebarSelectEvent,
  useCraftSidebarSelection,
} from '../../storage/framework/defaults/functions/craft'

interface TestCraftBridge {
  sidebar?: {
    onSelect: (
      handler: (event: CraftSidebarSelectEvent) => void,
    ) => (() => void) | void
  }
  _sidebarSelectHandler?: (event: CraftSidebarSelectEvent) => void
}

const runtime = globalThis as typeof globalThis & { craft?: TestCraftBridge }

afterEach(() => {
  delete runtime.craft
})

describe('Craft sidebar selection', () => {
  test('uses the native sidebar subscription when available', () => {
    let subscribedHandler: ((event: CraftSidebarSelectEvent) => void) | undefined
    let unsubscribed = false
    const selected: string[] = []

    runtime.craft = {
      sidebar: {
        onSelect(handler) {
          subscribedHandler = handler
          return () => {
            unsubscribed = true
          }
        },
      },
    }

    const remove = useCraftSidebarSelection(event => selected.push(event.itemId))
    subscribedHandler?.({ itemId: 'orders' })
    remove()

    expect(selected).toEqual(['orders'])
    expect(unsubscribed).toBe(true)
  })

  test('restores the legacy bootstrap handler during cleanup', () => {
    const legacySelections: string[] = []
    const selected: string[] = []
    const legacyHandler = (event: CraftSidebarSelectEvent) => {
      legacySelections.push(event.itemId)
    }

    runtime.craft = { _sidebarSelectHandler: legacyHandler }

    const remove = useCraftSidebarSelection(event => selected.push(event.itemId))
    runtime.craft._sidebarSelectHandler?.({ itemId: 'products' })
    remove()
    runtime.craft._sidebarSelectHandler?.({ itemId: 'settings' })

    expect(selected).toEqual(['products'])
    expect(legacySelections).toEqual(['settings'])
  })
})
