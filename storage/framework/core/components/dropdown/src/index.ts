import type { Plugin } from 'vue'
import type { NotificationProps } from './types'
import { Toaster as Notification } from './components'
import { notification } from './state'

export { Notification, notification, type NotificationProps }

const plugin: Plugin = {
  install(app) {
    app.component('Notification', Notification)
  },
}

export default plugin
