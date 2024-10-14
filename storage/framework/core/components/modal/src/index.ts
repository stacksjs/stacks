import type { Plugin } from 'vue'
import { Modal } from './components'
// import { notification } from './state'
// import type { NotificationProps } from './types'

// export type { NotificationProps }

const plugin: Plugin = {
  install(app) {
    app.component('Modal', Modal)
  },
}

export default plugin
