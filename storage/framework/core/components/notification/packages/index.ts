import type { Plugin } from 'vue'
import { Toaster as Notification } from './component'
import { notification } from './state'
import type { NotificationProps } from './types'

export { Notification, notification, type NotificationProps }

const plugin: Plugin = {
  install(app) {
    app.component('Notification', Notification)
  },
}

export default plugin
