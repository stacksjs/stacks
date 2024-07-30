import { listen } from '@stacksjs/events'
import { path as p } from '@stacksjs/path'
import events from './Events'

for (const key in events) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
    if (events.hasOwnProperty(key)) {
        const eventKey = key
        const eventListeners = events[key]

        for (const eventListener of eventListeners) {
            const modulePath = eventListener
            
            if (isFunction(modulePath)) {
                await modulePath()
            } else {
                try {
                    const actionModule = await import(p.projectPath(`Actions/${modulePath}.ts`))
    
                    listen(eventKey, e => actionModule.default.handle(e))
                } catch (error) {
                    console.error('Module not found:', modulePath);
                }
            }
        }
    }
  }

  function isFunction(val: unknown): val is Function {
    return typeof val === 'function'
  }