import type { Plugin } from 'vue'
import { Toaster as Notification } from './components'
import { useNotification } from './composables/useNotification'
import { notification } from './state'
import type { Action, ExternalToast, NotificationProps, ToastClasses, ToastT, ToastToDismiss } from './types'

export {
  useNotification,
  Notification,
  notification,
  type NotificationProps,
  type ToastT,
  type ToastToDismiss,
  type Action,
  type ExternalToast,
  type ToastClasses,
}

const plugin: Plugin = {
  install(app) {
    app.component('Notification', Notification)
  },
}

export default plugin
