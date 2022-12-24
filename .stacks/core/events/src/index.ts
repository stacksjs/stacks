import mitt from 'mitt'

type ApplicationEvents = {
  // 'user:registered': User
} | {}

const emitter = mitt<ApplicationEvents>()

const useEvent = emitter.emit
const dispatch = emitter.emit
const useListen = emitter.on
const listen = emitter.on
const off = emitter.off
const all = emitter.all

export { useEvent, useListen, dispatch, listen, all, off }

// fire an event
// useEvent('user:registered', { name: 'Chris'})
// dispatch('user:registered', { name: 'Chris'})
// capture
// useListen('user:registered', (user) => console.log(user))
// listen('user:registered', (user) => console.log(user))
