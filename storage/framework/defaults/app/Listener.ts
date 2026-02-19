import type { StacksEvents, WildcardHandler } from '@stacksjs/events'
import { handleError } from '@stacksjs/error-handling'
import { emitter } from '@stacksjs/events'
import { path as p } from '@stacksjs/path'
import events from './Events'

// Cache resolved action modules to avoid repeated dynamic imports
const actionCache = new Map<string, { handle: (event: any) => Promise<any> | any }>()

// Deduplicate in-flight imports to prevent concurrent import races
const pendingImports = new Map<string, Promise<{ handle: (event: any) => Promise<any> | any } | null>>()

// Pre-compute which event types have listeners for O(1) lookup
const eventTypes = new Set(Object.keys(events))

export async function handleEvents() {
  emitter.on('*', listenEvents as WildcardHandler<StacksEvents>)
}

function listenEvents(type: keyof typeof events, event: any) {
  // Fast path: skip events with no registered listeners
  if (!eventTypes.has(type as string))
    return

  const eventListeners = events[type]
  if (!eventListeners || eventListeners.length === 0)
    return

  // Fire-and-forget with error handling — mitt doesn't await wildcard handlers
  processListeners(type as string, eventListeners, event)
}

async function resolveAction(listener: string): Promise<{ handle: (event: any) => Promise<any> | any } | null> {
  // Check cache first
  const cached = actionCache.get(listener)
  if (cached) return cached

  // Check if an import is already in-flight
  let pending = pendingImports.get(listener)
  if (pending) return pending

  // Start the import and cache the promise to deduplicate concurrent calls
  pending = (async () => {
    try {
      const imported = await import(p.appPath(`Actions/${listener}.ts`))
      const actionModule = imported.default
      if (actionModule && typeof actionModule.handle === 'function') {
        actionCache.set(listener, actionModule)
        return actionModule
      }
      handleError(`Action "${listener}" does not export a handle method`)
      return null
    }
    catch (error) {
      handleError(`Failed to import action "${listener}"`, error)
      return null
    }
    finally {
      pendingImports.delete(listener)
    }
  })()

  pendingImports.set(listener, pending)
  return pending
}

async function processListeners(type: string, listeners: string[], event: any) {
  for (const listener of listeners) {
    try {
      if (typeof listener === 'function') {
        await (listener as any)(event)
        continue
      }

      const action = await resolveAction(listener)
      if (action) {
        await action.handle(event)
      }
    }
    catch (error) {
      handleError(`Failed to execute listener "${listener}" for event "${type}"`, error)
    }
  }
}
