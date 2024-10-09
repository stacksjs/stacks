import { listen } from '@stacksjs/events'
import { path as p } from '@stacksjs/path'
import events from './Events'

for (const key in events) {
  if (Object.hasOwn(events, key)) {
    const eventKey = key
    const eventListeners = events[key]

    for (const eventListener of eventListeners) {
      const modulePath = eventListener

      if (isFunction(modulePath)) {
        await modulePath()
      }
      else {
        try {
          const actionModule = await import(p.projectPath(`Actions/${modulePath}.ts`))

          listen(eventKey, e => actionModule.default.handle(e))
        }
        catch (error) {
          handleError(`Module not found: ${modulePath}`, error)
        }
      }
    }
  }
}

function isFunction(val: unknown) {
  return typeof val === 'function'
}
