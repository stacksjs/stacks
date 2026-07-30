import { afterEach, describe, expect, test } from 'bun:test'
import {
  ensureCraftNativeSidebarMarker,
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

const runtime = globalThis as typeof globalThis & {
  craft?: TestCraftBridge
  __craftNativeSidebar?: boolean
  location?: { search?: string }
  document?: { documentElement?: { setAttribute: (name: string, value: string) => void } }
}

afterEach(() => {
  delete runtime.craft
  delete runtime.__craftNativeSidebar
  delete runtime.location
  delete runtime.document
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

  test('normalizes the legacy native-sidebar flag to the document marker', () => {
    const attributes: Record<string, string> = {}
    runtime.__craftNativeSidebar = true
    runtime.document = {
      documentElement: {
        setAttribute(name, value) {
          attributes[name] = value
        },
      },
    }

    expect(ensureCraftNativeSidebarMarker()).toBe(true)
    expect(attributes).toEqual({ 'data-craft-native-sidebar': 'true' })
  })

  test('recognizes URL-mode native sidebars without treating every Craft window as one', () => {
    runtime.location = { search: '?native-sidebar=1' }
    expect(ensureCraftNativeSidebarMarker()).toBe(true)

    delete runtime.location
    delete runtime.__craftNativeSidebar
    runtime.craft = {} as TestCraftBridge
    expect(ensureCraftNativeSidebarMarker()).toBe(false)
  })
})
