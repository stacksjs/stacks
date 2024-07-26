import { path as p } from '@stacksjs/path'
import mitt from 'mitt'
import events from './Events'

const emitter = mitt()

for (const key in events) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
    if (events.hasOwnProperty(key)) {
        const eventKey = key
        const eventListeners = events[key]

        for (const eventListener of eventListeners) {
            const modulePath = eventListener
            try {
                const actionModule = await import(p.projectPath(`Actions/${modulePath}.ts`))

                emitter.on(eventKey, e => actionModule.default.handle(e))
                // Handle successful import
            } catch (error) {
                console.error('Module not found:', modulePath);
            }
        }
    }
  }