import type { StacksEvents, WildcardHandler } from '@stacksjs/events'
import { handleError } from '@stacksjs/error-handling'
import { emitter } from '@stacksjs/events'
import { path as p } from '@stacksjs/path'
import events from './Events'

export async function handleEvents() {
  emitter.on('*', listenEvents as WildcardHandler<StacksEvents>)
}

async function listenEvents(type: keyof typeof events, event: any) {
  const eventListeners = events[type]

  if (!eventListeners)
    return

  for (const eventListener of eventListeners) {
    if (isFunction(eventListener)) {
      await eventListener(event)
    }
    else {
      try {
        const actionModule = await import(p.appPath(`Actions/${eventListener}.ts`))
        await actionModule.default.handle(event)
      }
      catch (error) {
        handleError(`Module not found: ${eventListener}`, error)
      }
    }
  }
}

function isFunction(val: unknown) {
  return typeof val === 'function'
}
