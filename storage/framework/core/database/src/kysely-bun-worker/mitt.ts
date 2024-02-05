import type { Emitter, EventHandlerMap, EventType, Handler } from 'mitt'
import mitt from 'mitt'

export interface EmitterOnce<Events extends Record<EventType, unknown>> extends Emitter<Events> {
  once: <Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>) => void
}

export default function mittOnce<Events extends Record<EventType, unknown>>(
  all?: EventHandlerMap<Events>,
): EmitterOnce<Events> {
  const emitter = mitt<Events>(all)

  return {
    ...emitter,

    once<Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>) {
      const fn = (arg: Events[Key]) => {
        emitter.off(type, fn)
        handler(arg)
      }
      emitter.on(type, fn)
    },
  }
}
